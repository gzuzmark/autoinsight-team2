-- Phase F (D31): user reported (2026-09-26) many open ALTA/MEDIA alerts
-- while every KPI tile stayed green. This file covers D31 (10 of the 11
-- seed templates now link to a KPI with their own reading range, separate
-- from the alert's own valor range). D30 (a KPI stops recovering while an
-- open alert linked to it exists) is covered by a later commit's additions
-- to this same file.
begin;
select plan(9);

-- ---------------------------------------------------------------------------
-- Schema: lectura_min / lectura_max, CHECK constraints (D31). Run first,
-- before this file touches supabase/seed.sql's own catalog below.
-- ---------------------------------------------------------------------------

select has_column('public', 'plantillas_alerta', 'lectura_min', 'plantillas_alerta.lectura_min exists');
select has_column('public', 'plantillas_alerta', 'lectura_max', 'plantillas_alerta.lectura_max exists');

select throws_ok(
  $$ insert into public.plantillas_alerta
       (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso, indicador_clave, lectura_min, lectura_max)
     values ('parar', 'x sin rango', 1, '%', 0, 1, 1, 1, 'fpy', null, null) $$,
  '23514',
  null,
  'the lectura CHECK rejects an indicador-linked template with no reading range'
);
select throws_ok(
  $$ insert into public.plantillas_alerta
       (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso, indicador_clave, lectura_min, lectura_max)
     values ('parar', 'x rango invertido', 1, '%', 0, 1, 1, 1, 'fpy', 90, 80) $$,
  '23514',
  null,
  'the lectura CHECK rejects lectura_min > lectura_max'
);

-- ---------------------------------------------------------------------------
-- Seed parity (D31): 10 of the 11 seed templates are KPI-linked with a
-- reading range; "Nivel de refrigerante en rango" stays unlinked. Read-only
-- against the database supabase/seed.sql just seeded.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.plantillas_alerta
     where indicador_clave is not null and lectura_min is not null and lectura_max is not null),
  10,
  'seed: 10 templates are KPI-linked with a reading range'
);
select is(
  (select (indicador_clave, lectura_min, lectura_max) is null from public.plantillas_alerta
     where titulo = 'Nivel de refrigerante en rango'),
  true,
  'seed: Nivel de refrigerante en rango stays unlinked (no indicador_clave, no reading range)'
);

-- ---------------------------------------------------------------------------
-- D31: generating a KPI-linked alert records a reading in the KPI's own
-- lectura band, NOT the alert's own valor (Torque is Nm, but links to dph).
-- ---------------------------------------------------------------------------

update public.alertas set estado = 'no_aplica', resuelta_en = now() where estado = 'nueva';
delete from public.plantillas_alerta;

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Línea F', 'Turno mañana');
insert into public.indicadores
  (linea_id, clave, nombre, valor, unidad, mayor_es_mejor, umbral_atencion, umbral_parar, detalle, orden)
values
  ('66666666-6666-6666-6666-666666666666', 'dph', 'Defectos / hora', 5, 'defectos/h', false, 4, 6, 'Umbral de atención 4-6', 2);

insert into public.plantillas_alerta
    (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso, indicador_clave, lectura_min, lectura_max)
  values ('parar', 'Torque fuera de rango', 7, 'Nm', 8, 15, 10, 1, 'dph', 6.2, 9);

select public.demo_generar_alertas('66666666-6666-6666-6666-666666666666'::uuid, 1);

select ok(
  (select valor between 8 and 15 from public.alertas
     where linea_id = '66666666-6666-6666-6666-666666666666' and titulo = 'Torque fuera de rango'),
  'the generated alert''s own valor still falls within its own (Nm) range'
);
select ok(
  (select valor between 6.2 and 9 from public.indicadores
     where linea_id = '66666666-6666-6666-6666-666666666666' and clave = 'dph'),
  'the recorded dph reading falls within the template''s lectura range, not the torque Nm value'
);
select is(
  (select estado from public.indicadores where linea_id = '66666666-6666-6666-6666-666666666666' and clave = 'dph'),
  'parar'::public.severidad,
  'the recorded dph reading derives the parar state, matching the Torque template''s own severidad'
);

select * from finish();
rollback;
