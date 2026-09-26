-- H4 (Phase B'' hardening): dedupe active simulated alerts under
-- concurrency. The migration 2 version of public.demo_generar_alertas used
-- check-then-insert, which has a race window between two concurrent calls
-- (e.g. the cron job and a manual demo call, or two overlapping cron
-- ticks): both can pass the "not exists" check before either inserts.
--
-- This partial unique index makes "at most one active alert per
-- (linea_id, titulo)" a database-enforced invariant; the next migration
-- targets it with `on conflict ... do nothing` instead of relying on the
-- check. The existing seed data (supabase/seed.sql) has no two active
-- alerts on the same line sharing a titulo, so this index applies cleanly.

create unique index alertas_linea_titulo_nueva_uidx
  on public.alertas (linea_id, titulo)
  where estado = 'nueva';

-- H4: replace public.demo_generar_alertas' check-then-insert dedupe with
-- `on conflict` against the index above.

create or replace function public.demo_generar_alertas(p_linea_id uuid default null, p_cantidad int default 1)
returns setof public.alertas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i int;
  v_linea_id uuid;
  v_plantilla public.plantillas_alerta%rowtype;
  v_estacion_id uuid;
  v_valor numeric;
  v_id uuid;
begin
  for v_i in 1..greatest(p_cantidad, 0) loop
    v_id := null;
    v_linea_id := p_linea_id;
    if v_linea_id is null then
      select l.id into v_linea_id
      from public.lineas l
      order by random()
      limit 1;
    end if;

    if v_linea_id is null then
      continue; -- no lines exist at all
    end if;

    -- Weighted pick: Efraimidis-Spirakis weighted sampling. Each row gets a
    -- key = random()^(1/peso); the highest key wins. Unlike a -ln(random())
    -- formula, this never raises on random() = 0 (power(0, x) = 0, just the
    -- lowest possible key), so it cannot fail at runtime.
    -- H8: plantillas_alerta.peso is `check (peso > 0)` (migration 1), so
    -- every row already has a strictly positive weight; no extra
    -- "where peso > 0" filter is needed for this weighted pick.
    select t.* into v_plantilla
    from public.plantillas_alerta t
    order by power(random(), 1.0 / t.peso) desc
    limit 1;

    if not found then
      continue; -- no templates configured
    end if;

    select e.id into v_estacion_id
    from public.estaciones e
    where e.linea_id = v_linea_id
      and e.numero = v_plantilla.estacion_numero;

    v_valor := v_plantilla.valor_min + random() * (v_plantilla.valor_max - v_plantilla.valor_min);

    -- H4: dedupe against alertas_linea_titulo_nueva_uidx instead of a
    -- check-then-insert. If another call (concurrent or otherwise) already
    -- has this titulo active on this line, this insert is a no-op and
    -- v_id stays null.
    insert into public.alertas (
      linea_id, estacion_id, severidad, titulo, valor, limite, unidad
    )
    values (
      v_linea_id, v_estacion_id, v_plantilla.severidad, v_plantilla.titulo,
      round(v_valor, 2), v_plantilla.limite, v_plantilla.unidad
    )
    on conflict (linea_id, titulo) where estado = 'nueva' do nothing
    returning id into v_id;

    if v_id is null then
      continue; -- another caller already has this titulo active on this line
    end if;

    return query select * from public.alertas a where a.id = v_id;
  end loop;
end;
$$;
