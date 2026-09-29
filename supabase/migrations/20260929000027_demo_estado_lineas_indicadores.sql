-- Batch I (final-demo plan, 2026-09-29): the back office's "Estado de la
-- demo" card shows one worst-of KPI chip per line (H3, `estado_kpi`), which
-- collapses fpy/dph/scrap into a single word. Adds a per-line breakdown so
-- the facilitator can see "FPY ATENCIÓN · Defectos/h ATENCIÓN · Scrap OK"
-- next to it, in a stable clave order (fpy, dph, scrap) matching the floor
-- tablet's own KPI tile order (lib/mock-data.ts's INDICADORES declaration
-- order).
--
-- Redefined here (`create or replace`, from its migration-026 body -- no
-- grant/revoke changes needed, those already apply to this function
-- name/signature and persist across a replace) to add one more field,
-- `indicadores`: a jsonb array of `{clave, estado}`, one per KPI on the
-- line. `estado_kpi`, `alertas_abiertas`, `alertas_alta/media/baja` and
-- `ultima_simulacion` are unchanged.
create or replace function public.demo_estado_lineas()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.nombre), '[]'::jsonb)
  from (
    select
      l.nombre,
      coalesce(
        (
          select i.estado::text
          from public.indicadores i
          where i.linea_id = l.id
          order by case i.estado when 'parar' then 0 when 'atencion' then 1 else 2 end
          limit 1
        ),
        'ok'
      ) as estado_kpi,
      (select count(*)::int from public.alertas a where a.linea_id = l.id and a.estado = 'nueva') as alertas_abiertas,
      (select count(*)::int from public.alertas a where a.linea_id = l.id and a.estado = 'nueva' and a.severidad = 'parar') as alertas_alta,
      (select count(*)::int from public.alertas a where a.linea_id = l.id and a.estado = 'nueva' and a.severidad = 'atencion') as alertas_media,
      (select count(*)::int from public.alertas a where a.linea_id = l.id and a.estado = 'nueva' and a.severidad = 'ok') as alertas_baja,
      dp.ultima_simulacion,
      coalesce(
        (
          select jsonb_agg(jsonb_build_object('clave', i.clave, 'estado', i.estado::text) order by
            case i.clave when 'fpy' then 0 when 'dph' then 1 when 'scrap' then 2 else 3 end)
          from public.indicadores i
          where i.linea_id = l.id
        ),
        '[]'::jsonb
      ) as indicadores
    from public.lineas l
    left join public.demo_panel dp on dp.linea_id = l.id
  ) t;
$$;

comment on function public.demo_estado_lineas() is
  'Estado por línea para el back office: nombre, peor estado de KPI de la línea (H3, igual que '
  'las tarjetas de la planta), cada KPI (fpy/dph/scrap) con su propio estado (Batch I), alertas '
  'abiertas totales y por severidad (alta/media/baja), y última simulación de turno.';
