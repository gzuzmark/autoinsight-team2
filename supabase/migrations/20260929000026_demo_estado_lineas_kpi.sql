-- H3: `public.demo_estado_lineas()` (migration 20260928000021) mapped the
-- line's most severe OPEN ALERT onto the KPI vocabulary (e.g. a single ALTA
-- alert reported the line as "parar") -- mixing the D8 alert vocabulary
-- (ALTA/MEDIA/BAJA) with the D10 KPI vocabulary (OK/ATENCIÓN/PARAR), and
-- able to disagree with the floor tablet's own KPI tiles once a KPI
-- recovers while its alert is still open (D26).
--
-- Redefined here (`create or replace`, no grant/revoke changes needed --
-- those already apply to this function name/signature and persist across a
-- replace) to instead return:
--   - `estado_kpi`: the worst of the line's own fpy/dph/scrap states (the
--     SAME computation the floor's KPI tiles use, via the `indicadores`
--     generated `estado` column) -- independent of alert severity.
--   - `alertas_alta`/`alertas_media`/`alertas_baja`: open ("nueva") alert
--     counts per severity, so the back office can still show alert activity
--     (e.g. "4 alertas · 2 ALTA") next to the now KPI-only chip.
-- `alertas_abiertas` (total) and `ultima_simulacion` are unchanged.
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
      dp.ultima_simulacion
    from public.lineas l
    left join public.demo_panel dp on dp.linea_id = l.id
  ) t;
$$;

comment on function public.demo_estado_lineas() is
  'Estado por línea para el back office: nombre, peor estado de KPI de la línea (H3, igual que '
  'las tarjetas de la planta), alertas abiertas totales y por severidad (alta/media/baja), y '
  'última simulación de turno.';
