-- H3: `demo_estado_lineas()` reports the worst KPI state of each line
-- (`estado_kpi`) independently of alert severity, plus open-alert counts
-- per severity (`alertas_alta`/`alertas_media`/`alertas_baja`).
begin;
select plan(7);

select id as linea3_id from public.lineas where nombre = 'Línea 3 · Motores' \gset l3_

-- Isolate from any other test file's leftovers, same pattern as 05_demo.test.sql.
delete from public.alertas;
select private.sembrar_alertas_linea3(:'l3_linea3_id');

-- Línea 3 seed: 7 alerts -- 2 parar, 3 atencion, 2 ok (see
-- private.sembrar_alertas_linea3). Its worst KPI (fpy 88.4) is "parar".
select is(
  (select (e ->> 'alertas_alta')::int from jsonb_array_elements(public.demo_estado_lineas()) e
     where e ->> 'nombre' = 'Línea 3 · Motores'),
  2,
  'Línea 3 reports 2 open ALTA alerts'
);
select is(
  (select (e ->> 'alertas_media')::int from jsonb_array_elements(public.demo_estado_lineas()) e
     where e ->> 'nombre' = 'Línea 3 · Motores'),
  3,
  'Línea 3 reports 3 open MEDIA alerts'
);
select is(
  (select (e ->> 'alertas_baja')::int from jsonb_array_elements(public.demo_estado_lineas()) e
     where e ->> 'nombre' = 'Línea 3 · Motores'),
  2,
  'Línea 3 reports 2 open BAJA alerts'
);

-- Línea 2's seeded KPIs (fpy 90.1, dph 4.5, scrap 2.4 -- see supabase/seed.sql)
-- are all in their atencion band, and it has no seeded alerts.
select is(
  (select e ->> 'estado_kpi' from jsonb_array_elements(public.demo_estado_lineas()) e
     where e ->> 'nombre' = 'Línea 2 · Pintura'),
  'atencion',
  'Línea 2 reports "atencion" (worst of its own KPIs), independent of its (zero) open alerts'
);
select is(
  (select (e ->> 'alertas_alta')::int + (e ->> 'alertas_media')::int + (e ->> 'alertas_baja')::int
     from jsonb_array_elements(public.demo_estado_lineas()) e
     where e ->> 'nombre' = 'Línea 2 · Pintura'),
  0,
  'Línea 2 has no open alerts'
);

-- D26 decoupling: attending every open ALTA alert on Línea 3 does not, by
-- itself, change its KPI reading -- estado_kpi stays "parar" even though
-- alertas_alta drops to 0 (unlike the old alert-based chip, which would
-- have reported "ok"/no-severity here).
update public.alertas
set estado = 'atendida', resuelta_en = now(),
    resuelta_por = (select id from public.usuarios where nombre = 'Ana Ríos')
where linea_id = :'l3_linea3_id' and severidad = 'parar' and estado = 'nueva';

select is(
  (select (e ->> 'alertas_alta')::int from jsonb_array_elements(public.demo_estado_lineas()) e
     where e ->> 'nombre' = 'Línea 3 · Motores'),
  0,
  'Línea 3 has 0 open ALTA alerts after attending them'
);
select is(
  (select e ->> 'estado_kpi' from jsonb_array_elements(public.demo_estado_lineas()) e
     where e ->> 'nombre' = 'Línea 3 · Motores'),
  'parar',
  'Línea 3''s estado_kpi still reports "parar" (D26: attending an alert never recovers its KPI by itself)'
);

select * from finish();
rollback;
