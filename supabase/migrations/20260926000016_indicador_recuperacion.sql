-- Phase D (D26): recovery reading -- a shift simulation or the stale-alert
-- auto-resolve job both act as a "good shift" signal for the KPIs they
-- didn't just record a bad reading on: every OTHER indicator of the
-- affected line moves ONE state toward ok, landing inside its new (better)
-- band. Builds on 20260926000015 (thresholds, derived estado,
-- demo_generar_alertas' reading recording). `resolver_alerta` is still
-- never touched: operator resolution must never change a KPI.

-- private.recuperar_indicadores: moves every indicador of p_linea_id whose
-- clave is NOT in p_excluir one state toward ok:
--   parar    -> a value inside the atencion band (midpoint of its two
--               thresholds).
--   atencion -> a value just inside the ok band.
--   ok       -> stays ok (small, direction-safe nudge; still refreshes
--               actualizado_en so "desactualizado" clears).
-- Never lets a lower-is-better valor go negative. Deliberately not
-- SECURITY DEFINER's concern to check who calls it: it is never reachable
-- through PostgREST (private is not exposed) and both its callers below
-- are themselves SECURITY DEFINER.
create function private.recuperar_indicadores(p_linea_id uuid, p_excluir text[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_nuevo_valor numeric;
  v_paso numeric;
begin
  for r in
    select i.id, i.valor, i.estado, i.mayor_es_mejor, i.umbral_atencion, i.umbral_parar
    from public.indicadores i
    where i.linea_id = p_linea_id
      and not (i.clave = any (p_excluir))
  loop
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

-- demo_simular_turno: unchanged K1/K5 free-room logic, plus a recovery pass
-- afterwards excluding the claves the just-generated alerts hit (looked up
-- by titulo, the same way demo_generar_alertas' own dedupe check works).
create or replace function public.demo_simular_turno(p_sesion_id uuid, p_cantidad int default 2)
returns setof public.alertas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linea_id uuid;
  v_disponibles int;
  v_alertas public.alertas[];
  v_claves text[];
begin
  select linea_id into v_linea_id
  from private.validar_sesion(p_sesion_id);

  select count(*) into v_disponibles
  from public.plantillas_alerta t
  where not exists (
    select 1 from public.alertas a
    where a.linea_id = v_linea_id and a.titulo = t.titulo and a.estado = 'nueva'
  );

  if v_disponibles < greatest(p_cantidad, 0) then
    update public.alertas
    set estado = 'no_aplica',
        resuelta_en = now(),
        resuelta_por = null
    where id in (
      select a.id
      from public.alertas a
      where a.linea_id = v_linea_id
        and a.estado = 'nueva'
        and a.titulo in (select t.titulo from public.plantillas_alerta t)
      order by a.creada_en asc
      limit greatest(p_cantidad, 0) - v_disponibles
      for update skip locked
    );
  end if;

  select array_agg(a) into v_alertas
  from public.demo_generar_alertas(v_linea_id, p_cantidad) a;

  select array_agg(distinct t.indicador_clave) into v_claves
  from unnest(v_alertas) a
  join public.plantillas_alerta t on t.titulo = a.titulo
  where t.indicador_clave is not null;

  perform private.recuperar_indicadores(v_linea_id, coalesce(v_claves, '{}'::text[]));

  if v_alertas is not null then
    return query select * from unnest(v_alertas);
  end if;
end;
$$;

revoke execute on function public.demo_simular_turno(uuid, int) from public, anon, authenticated;
grant execute on function public.demo_simular_turno(uuid, int) to service_role;

-- demo_autoresolver: unchanged staleness rule, plus a recovery pass for
-- every distinct line where it closed at least one alert (excluding
-- nothing: an auto-resolved line gets a clean-shift-style recovery on all
-- of its KPIs, the same as a shift simulation that hits none of them).
create or replace function public.demo_autoresolver(
  p_antiguedad interval default private.antiguedad_autoresolver_defecto()
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_lineas uuid[];
  v_linea_id uuid;
begin
  with resueltas as (
    update public.alertas
    set estado = 'no_aplica',
        resuelta_en = now()
    where estado = 'nueva'
      and creada_en < now() - p_antiguedad
    returning linea_id
  )
  select coalesce(array_agg(distinct linea_id), '{}'::uuid[]), count(*)
    into v_lineas, v_count
  from resueltas;

  foreach v_linea_id in array v_lineas loop
    perform private.recuperar_indicadores(v_linea_id, '{}'::text[]);
  end loop;

  return coalesce(v_count, 0);
end;
$$;
