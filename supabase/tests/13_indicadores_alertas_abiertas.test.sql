-- Phase F (D30-D31): user reported (2026-09-26) many open ALTA/MEDIA alerts
-- while every KPI tile stayed green. Cause: an open KPI-linked alert blocks
-- its own template (dedupe), so later shifts never re-read that KPI and the
-- D26 recovery pass greens it anyway. D30: a KPI never recovers while an
-- open (`estado = 'nueva'`) alert linked to it exists on the line -- each
-- shift instead re-reads it from the MOST SEVERE such alert's template
-- reading range (parar over atencion, tie -> newest). D31: 10 of the 11
-- seed templates now link to a KPI with their own reading range
-- (lectura_min/lectura_max); "Nivel de refrigerante en rango" stays
-- unlinked.
begin;
select plan(14);

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
-- Fixtures for the behavior tests below: isolate from seed.sql's own
-- catalog/alerts, matching the pattern used by 05_demo.test.sql /
-- 09_indicadores_lecturas.test.sql.
-- ---------------------------------------------------------------------------

update public.alertas set estado = 'no_aplica', resuelta_en = now() where estado = 'nueva';
delete from public.plantillas_alerta;

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno)
  values ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Línea F', 'Turno mañana');
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', 'Gus Peña', 'GP', '#16a34a');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('77777777-7777-7777-7777-777777777777', extensions.crypt('1111', extensions.gen_salt('bf')));

insert into public.indicadores
  (linea_id, clave, nombre, valor, unidad, mayor_es_mejor, umbral_atencion, umbral_parar, detalle, orden)
values
  ('66666666-6666-6666-6666-666666666666', 'fpy', 'FPY', 88.4, '%', true, 92, 90, 'Rendimiento a primera pasada', 1),
  ('66666666-6666-6666-6666-666666666666', 'dph', 'Defectos / hora', 5, 'defectos/h', false, 4, 6, 'Umbral de atención 4-6', 2),
  ('66666666-6666-6666-6666-666666666666', 'scrap', 'Scrap', 1.6, '%', false, 2, 3, 'Dentro del objetivo (<= 2 %)', 3);

select public.iniciar_sesion('77777777-7777-7777-7777-777777777777', '1111') \gset s_

-- ---------------------------------------------------------------------------
-- D30: a KPI held by an open linked alert stays put across shifts that
-- generate only OTHER (unlinked) templates -- today it would recover
-- (RED). Reading range 82-89.5 is entirely inside the fpy parar band
-- (< 90), so the held KPI stays parar regardless of the random draw.
-- ---------------------------------------------------------------------------

insert into public.plantillas_alerta
    (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso, indicador_clave, lectura_min, lectura_max)
  values ('parar', 'FPY por debajo del objetivo', 4, '%', 82, 89.5, 90, 1, 'fpy', 82, 89.5);
insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso)
  values
    ('atencion', 'Prueba A', 1, '%', 1, 2, 5, 1),
    ('atencion', 'Prueba B', 1, '%', 1, 2, 5, 1),
    ('atencion', 'Prueba C', 1, '%', 1, 2, 5, 1);

insert into public.alertas (linea_id, severidad, titulo, valor, limite, unidad, creada_en)
  values ('66666666-6666-6666-6666-666666666666', 'parar', 'FPY por debajo del objetivo', 85, 90, '%', now() - interval '5 minutes')
  returning id as fpy_alerta_id \gset

select private.simular_turno_en_linea('66666666-6666-6666-6666-666666666666'::uuid, 1);
select is(
  (select estado from public.indicadores where linea_id = '66666666-6666-6666-6666-666666666666' and clave = 'fpy'),
  'parar'::public.severidad,
  'a KPI held by an open linked alert stays parar after 1 shift generating only other templates'
);

select private.simular_turno_en_linea('66666666-6666-6666-6666-666666666666'::uuid, 1);
select is(
  (select estado from public.indicadores where linea_id = '66666666-6666-6666-6666-666666666666' and clave = 'fpy'),
  'parar'::public.severidad,
  'a KPI held by an open linked alert stays parar after 2 shifts generating only other templates'
);

-- ---------------------------------------------------------------------------
-- D30: resolving the held alert changes nothing immediately; recovery
-- resumes on the next shift, once no open linked alert remains.
-- ---------------------------------------------------------------------------

select (
  select jsonb_build_object('valor', valor, 'estado', estado, 'actualizado_en', actualizado_en)
  from public.indicadores where linea_id = '66666666-6666-6666-6666-666666666666' and clave = 'fpy'
) as pre_resolve \gset

select public.resolver_alerta(:'s_iniciar_sesion', :'fpy_alerta_id', 'atendida');

select is(
  (select jsonb_build_object('valor', valor, 'estado', estado, 'actualizado_en', actualizado_en)
     from public.indicadores where linea_id = '66666666-6666-6666-6666-666666666666' and clave = 'fpy'),
  :'pre_resolve'::jsonb,
  'resolving the alert that held a KPI does not change that KPI at that moment'
);

-- The FPY template can never be regenerated in this test (deterministic:
-- one spare unlinked template is still available for the next shift).
delete from public.plantillas_alerta where titulo = 'FPY por debajo del objetivo';

select private.simular_turno_en_linea('66666666-6666-6666-6666-666666666666'::uuid, 1);
select is(
  (select estado from public.indicadores where linea_id = '66666666-6666-6666-6666-666666666666' and clave = 'fpy'),
  'atencion'::public.severidad,
  'once the holding alert is resolved, the next shift recovers the KPI one step toward ok'
);

-- ---------------------------------------------------------------------------
-- D31: generating a KPI-linked alert records a reading in the KPI's own
-- lectura band, NOT the alert's own valor (Torque is Nm, but links to dph).
-- ---------------------------------------------------------------------------

delete from public.plantillas_alerta;
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

-- ---------------------------------------------------------------------------
-- Scenario: generating several KPI-linked templates in a row can no longer
-- yield an open atencion/parar alert whose KPI shows ok.
-- ---------------------------------------------------------------------------

delete from public.plantillas_alerta;
insert into public.plantillas_alerta
    (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso, indicador_clave, lectura_min, lectura_max)
  values
    ('atencion', 'Defectos por hora en aumento', 2, 'defectos/h', 4.5, 6, 4, 3, 'dph', 4.5, 6),
    ('parar', 'Sensor de presión sin respuesta', 6, 'kPa', 0, 50, 80, 2, 'dph', 6.2, 9),
    ('atencion', 'Scrap por encima del objetivo', 3, '%', 2.1, 2.9, 2, 1, 'scrap', 2.1, 2.9);

select private.simular_turno_en_linea('66666666-6666-6666-6666-666666666666'::uuid, 2);
select private.simular_turno_en_linea('66666666-6666-6666-6666-666666666666'::uuid, 2);
select private.simular_turno_en_linea('66666666-6666-6666-6666-666666666666'::uuid, 2);

select ok(
  not exists (
    select 1
    from public.indicadores i
    join public.alertas a on a.linea_id = i.linea_id
    join public.plantillas_alerta t on t.titulo = a.titulo
    where i.linea_id = '66666666-6666-6666-6666-666666666666'
      and a.estado = 'nueva'
      and t.indicador_clave = i.clave
      and a.severidad in ('atencion', 'parar')
      and i.estado = 'ok'
  ),
  'no KPI shows ok while an open linked alert for it is atencion/parar'
);

select * from finish();
rollback;
