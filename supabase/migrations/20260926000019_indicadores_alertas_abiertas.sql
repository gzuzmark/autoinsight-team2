-- Phase F (D30-D31): user reported (2026-09-26) many open ALTA/MEDIA alerts
-- on a line while every KPI tile stayed green. Cause: an open KPI-linked
-- alert blocks its own template (dedupe, H4/migration 20260925000005), so
-- later shifts never re-read that KPI, and the D26 recovery pass
-- (private.recuperar_indicadores) greens it anyway because it only knows
-- about the KPI it just wrote, not about other open alerts still pointing
-- at a different one. Only 3 of 11 templates were KPI-linked, so this was
-- rare in the seed catalog but common once more alerts accumulate.
--
-- D31: link 10 of the 11 seed templates to a KPI, each with its own
-- reading range (`lectura_min`/`lectura_max`, in the KPI's unit -- distinct
-- from `valor_min`/`valor_max`, the alert's own displayed value range).
-- D30: a KPI never recovers while an open (`estado = 'nueva'`) alert linked
-- to it exists on the line; every shift instead re-reads it from the MOST
-- SEVERE such alert's template range (parar over atencion, tie -> newest).
-- Resolving still changes nothing immediately -- recovery can resume on the
-- next shift, once no open linked alert remains.

-- ---------------------------------------------------------------------------
-- 1. plantillas_alerta.lectura_min / lectura_max (D31).
-- ---------------------------------------------------------------------------

alter table public.plantillas_alerta
  add column lectura_min numeric,
  add column lectura_max numeric;

-- Both null or both set with min <= max; required (both set) whenever
-- indicador_clave is set, since demo_generar_alertas (below) needs a range
-- to draw the recorded KPI reading from.
alter table public.plantillas_alerta
  add constraint plantillas_alerta_lectura_check check (
    (lectura_min is null) = (lectura_max is null)
    and (lectura_min is null or lectura_min <= lectura_max)
    and (indicador_clave is null or lectura_min is not null)
  );

-- ---------------------------------------------------------------------------
-- 2. demo_generar_alertas: record the reading from lectura_min/lectura_max,
--    not the alert's own valor (D31). Everything else (available-line pick,
--    available-template pick, ON CONFLICT DO NOTHING, reading only for an
--    inserted alert) is unchanged from 20260926000017.
-- ---------------------------------------------------------------------------

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
  v_lectura numeric;
  v_id uuid;
begin
  for v_i in 1..greatest(p_cantidad, 0) loop
    v_id := null;
    v_linea_id := p_linea_id;
    if v_linea_id is null then
      -- Only lines that still have at least one template not already active.
      select l.id into v_linea_id
      from public.lineas l
      where exists (
        select 1 from public.plantillas_alerta t
        where not exists (
          select 1 from public.alertas a
          where a.linea_id = l.id and a.titulo = t.titulo and a.estado = 'nueva'
        )
      )
      order by random()
      limit 1;
    end if;

    if v_linea_id is null then
      continue; -- no line has an available template
    end if;

    -- Weighted pick among templates not already active on this line.
    select t.* into v_plantilla
    from public.plantillas_alerta t
    where not exists (
      select 1 from public.alertas a
      where a.linea_id = v_linea_id and a.titulo = t.titulo and a.estado = 'nueva'
    )
    order by power(random(), 1.0 / t.peso) desc
    limit 1;

    if not found then
      continue; -- no template left that is not already active on this line
    end if;

    select e.id into v_estacion_id
    from public.estaciones e
    where e.linea_id = v_linea_id
      and e.numero = v_plantilla.estacion_numero;

    v_valor := round(
      (v_plantilla.valor_min + random() * (v_plantilla.valor_max - v_plantilla.valor_min))::numeric,
      2
    );

    insert into public.alertas (
      linea_id, estacion_id, severidad, titulo, valor, limite, unidad
    )
    values (
      v_linea_id, v_estacion_id, v_plantilla.severidad, v_plantilla.titulo,
      v_valor, v_plantilla.limite, v_plantilla.unidad
    )
    on conflict (linea_id, titulo) where estado = 'nueva' do nothing
    returning id into v_id;

    if v_id is null then
      continue; -- a concurrent caller already has this titulo active here
    end if;

    -- D31: a KPI-linked template records a reading drawn from its OWN
    -- lectura_min/lectura_max range (the KPI's unit), not this alert's
    -- valor (the alert's own displayed unit/range can differ, e.g. Torque
    -- is Nm but records a dph reading).
    if v_plantilla.indicador_clave is not null then
      v_lectura := round(
        (v_plantilla.lectura_min + random() * (v_plantilla.lectura_max - v_plantilla.lectura_min))::numeric,
        2
      );
      update public.indicadores
      set valor = v_lectura,
          actualizado_en = now()
      where linea_id = v_linea_id
        and clave = v_plantilla.indicador_clave;
    end if;

    return query select * from public.alertas a where a.id = v_id;
  end loop;
end;
$$;

revoke execute on function public.demo_generar_alertas(uuid, int) from public, anon, authenticated;
grant execute on function public.demo_generar_alertas(uuid, int) to service_role;

-- ---------------------------------------------------------------------------
-- 3. private.recuperar_indicadores: a KPI held by an open linked alert
--    re-reads from that alert's template range instead of recovering (D30).
-- ---------------------------------------------------------------------------

create or replace function private.recuperar_indicadores(p_linea_id uuid, p_excluir text[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_lectura_min numeric;
  v_lectura_max numeric;
  v_nuevo_valor numeric;
  v_paso numeric;
begin
  for r in
    select i.id, i.clave, i.valor, i.estado, i.mayor_es_mejor, i.umbral_atencion, i.umbral_parar
    from public.indicadores i
    where i.linea_id = p_linea_id
      and not (i.clave = any (p_excluir))
  loop
    -- D30: an open alert linked to this KPI holds it -- re-read from the
    -- MOST SEVERE such alert's template range (parar over atencion, tie ->
    -- newest) instead of recovering it toward ok.
    select t.lectura_min, t.lectura_max
      into v_lectura_min, v_lectura_max
    from public.alertas a
    join public.plantillas_alerta t on t.titulo = a.titulo
    where a.linea_id = p_linea_id
      and a.estado = 'nueva'
      and t.indicador_clave = r.clave
    order by
      case a.severidad when 'parar' then 0 when 'atencion' then 1 else 2 end,
      a.creada_en desc
    limit 1;

    if found then
      update public.indicadores
      set valor = round((v_lectura_min + random() * (v_lectura_max - v_lectura_min))::numeric, 2),
          actualizado_en = now()
      where id = r.id;
      continue;
    end if;

    if r.estado = 'parar' then
      v_nuevo_valor := (r.umbral_parar + r.umbral_atencion) / 2;
    elsif r.estado = 'atencion' then
      v_paso := greatest(abs(r.umbral_atencion) * 0.02, 0.1);
      v_nuevo_valor := case
        when r.mayor_es_mejor then r.umbral_atencion + v_paso
        else greatest(r.umbral_atencion - v_paso, 0)
      end;
    else
      v_paso := greatest(abs(r.valor) * 0.01, 0.05) * random();
      v_nuevo_valor := case
        when r.mayor_es_mejor then r.valor + v_paso
        else greatest(r.valor - v_paso, 0)
      end;
    end if;

    update public.indicadores
    set valor = round(v_nuevo_valor, 2),
        actualizado_en = now()
    where id = r.id;
  end loop;
end;
$$;

revoke execute on function private.recuperar_indicadores(uuid, text[]) from public;
grant execute on function private.recuperar_indicadores(uuid, text[]) to postgres, service_role;

-- ---------------------------------------------------------------------------
-- 4. Backfill (D31): databases seeded before this migration (e.g. staging)
--    already have all 11 templates (H4/017 backfilled the 2 missing ones by
--    titulo); link the remaining 7 and add lectura ranges to all 10. On a
--    fresh database this table is still empty when migrations run (seed.sql
--    loads afterwards, same guard pattern as 20260926000017), so nothing is
--    updated here and seed.sql is the single source of its rows.
-- ---------------------------------------------------------------------------

update public.plantillas_alerta t
set indicador_clave = v.indicador_clave,
    lectura_min = v.lectura_min,
    lectura_max = v.lectura_max
from (values
  ('FPY por debajo del objetivo', 'fpy', 82::numeric, 89.5::numeric),
  ('Paro de línea por fuga de aire', 'fpy', 84::numeric, 89.5::numeric),
  ('Retrabajo sobre lo esperado', 'fpy', 90.2::numeric, 91.8::numeric),
  ('Defectos por hora en aumento', 'dph', 4.5::numeric, 6::numeric),
  ('Torque fuera de rango', 'dph', 6.2::numeric, 9::numeric),
  ('Sensor de presión sin respuesta', 'dph', 6.2::numeric, 9::numeric),
  ('Vibración anómala en banda', 'dph', 4.2::numeric, 5.9::numeric),
  ('Scrap por encima del objetivo', 'scrap', 2.1::numeric, 2.9::numeric),
  ('Temperatura de horno alta', 'scrap', 2.1::numeric, 2.9::numeric),
  ('Nivel de adhesivo bajo', 'scrap', 2.1::numeric, 2.9::numeric)
) as v (titulo, indicador_clave, lectura_min, lectura_max)
where t.titulo = v.titulo
  and exists (select 1 from public.plantillas_alerta)
  and t.lectura_min is distinct from v.lectura_min;
