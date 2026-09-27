-- Phase D (D24-D25): KPI state is derived from valor + per-indicator
-- thresholds, never stored independently (indicadores.estado is a GENERATED
-- column); generating a KPI-linked alert records a new reading on the
-- matching indicador, a non-KPI-linked alert changes none.
begin;
select plan(18);

-- Isolate from supabase/seed.sql: clear the active alerts and template
-- catalog so this file's own weighted picks are deterministic, matching
-- the pattern used in 05_demo.test.sql / 07_demo_simular_turno.test.sql.
update public.alertas set estado = 'no_aplica', resuelta_en = now() where estado = 'nueva';
delete from public.plantillas_alerta;

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Línea Test', 'Turno mañana');
insert into public.estaciones (linea_id, numero, nombre)
  values ('22222222-2222-2222-2222-222222222222', 1, 'Ensamble');

insert into public.indicadores
  (linea_id, clave, nombre, valor, unidad, mayor_es_mejor, umbral_atencion, umbral_parar, detalle, orden)
values
  ('22222222-2222-2222-2222-222222222222', 'fpy', 'FPY', 88.4, '%', true, 92, 90, 'Rendimiento a primera pasada', 1),
  ('22222222-2222-2222-2222-222222222222', 'dph', 'Defectos / hora', 5, 'defectos/h', false, 4, 6, 'Umbral de atención 4-6', 2),
  ('22222222-2222-2222-2222-222222222222', 'scrap', 'Scrap', 1.6, '%', false, 2, 3, 'Dentro del objetivo (<= 2 %)', 3);

-- ---------------------------------------------------------------------------
-- Schema: threshold columns, CHECK constraints, generated estado.
-- ---------------------------------------------------------------------------

select has_column('public', 'indicadores', 'mayor_es_mejor', 'indicadores.mayor_es_mejor exists');
select has_column('public', 'indicadores', 'umbral_atencion', 'indicadores.umbral_atencion exists');
select has_column('public', 'indicadores', 'umbral_parar', 'indicadores.umbral_parar exists');
select col_not_null('public', 'indicadores', 'mayor_es_mejor', 'indicadores.mayor_es_mejor is not null');
select has_column('public', 'plantillas_alerta', 'indicador_clave', 'plantillas_alerta.indicador_clave exists');

-- estado is a generated column: it cannot be assigned an explicit value.
select throws_ok(
  $$ update public.indicadores set estado = 'ok' where clave = 'fpy' and linea_id = '22222222-2222-2222-2222-222222222222' $$,
  '428C9',
  null,
  'indicadores.estado is a generated column (cannot be written directly)'
);

-- Threshold consistency CHECK rejects an inverted higher-is-better row.
select throws_ok(
  $$ insert into public.indicadores
       (linea_id, clave, nombre, valor, unidad, mayor_es_mejor, umbral_atencion, umbral_parar, detalle, orden)
     values
       ('22222222-2222-2222-2222-222222222222', 'bogus', 'Bogus', 1, '%', true, 90, 92, 'x', 9) $$,
  '23514',
  null,
  'the umbrales CHECK rejects mayor_es_mejor=true with umbral_atencion <= umbral_parar'
);

-- plantillas_alerta.indicador_clave CHECK rejects an unknown clave.
select throws_ok(
  format(
    $$ insert into public.plantillas_alerta
         (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso, indicador_clave)
       values ('ok', 'x', 1, '%%', 0, 1, 1, 1, 'no-such-clave') $$
  ),
  '23514',
  null,
  'plantillas_alerta.indicador_clave CHECK rejects an unknown clave'
);

-- ---------------------------------------------------------------------------
-- private.estado_indicador: direction + boundary values.
-- ---------------------------------------------------------------------------

select is(private.estado_indicador(88.4, true, 92, 90), 'parar'::public.severidad, 'higher-is-better below parar threshold is parar');
select is(private.estado_indicador(90, true, 92, 90), 'atencion'::public.severidad, 'higher-is-better AT the parar threshold is atencion (boundary favors the better band)');
select is(private.estado_indicador(92, true, 92, 90), 'ok'::public.severidad, 'higher-is-better AT the atencion threshold is ok');
select is(private.estado_indicador(5, false, 4, 6), 'atencion'::public.severidad, 'lower-is-better above the atencion threshold is atencion');
select is(private.estado_indicador(6, false, 4, 6), 'atencion'::public.severidad, 'lower-is-better AT the parar threshold is atencion (boundary favors the better band)');
select is(private.estado_indicador(6.01, false, 4, 6), 'parar'::public.severidad, 'lower-is-better above the parar threshold is parar');
select is(private.estado_indicador(1.6, false, 2, 3), 'ok'::public.severidad, 'lower-is-better at or below the atencion threshold is ok');

-- ---------------------------------------------------------------------------
-- Generating a KPI-linked alert records the reading (D25). As of Phase F
-- (D31), the recorded reading is drawn from the template's OWN
-- lectura_min/lectura_max range, not the alert's own valor (see
-- supabase/tests/13_indicadores_alertas_abiertas.test.sql for the
-- lectura-vs-valor separation, e.g. Torque/Nm recording a dph reading).
-- ---------------------------------------------------------------------------

insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso, indicador_clave, lectura_min, lectura_max)
  values ('atencion', 'FPY por debajo del objetivo', 1, '%', 85, 89, 90, 1, 'fpy', 90.2, 91.8);

select public.demo_generar_alertas('22222222-2222-2222-2222-222222222222'::uuid, 1);

select ok(
  (select valor between 90.2 and 91.8 from public.indicadores
     where linea_id = '22222222-2222-2222-2222-222222222222' and clave = 'fpy'),
  'generating a KPI-linked alert records a reading within the template''s lectura range'
);
select ok(
  (select actualizado_en > now() - interval '1 minute' from public.indicadores
     where linea_id = '22222222-2222-2222-2222-222222222222' and clave = 'fpy'),
  'generating a KPI-linked alert refreshes actualizado_en'
);

-- A non-KPI-linked alert changes no indicador ---------------------------
insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso)
  values ('atencion', 'Nivel de adhesivo bajo', 1, '%', 10, 30, 25, 1);
select (
  select jsonb_agg(jsonb_build_object('clave', clave, 'valor', valor, 'actualizado_en', actualizado_en) order by clave)
  from public.indicadores where linea_id = '22222222-2222-2222-2222-222222222222'
) as before_state \gset
select public.demo_generar_alertas('22222222-2222-2222-2222-222222222222'::uuid, 1);
select is(
  (select jsonb_agg(jsonb_build_object('clave', clave, 'valor', valor, 'actualizado_en', actualizado_en) order by clave)
     from public.indicadores where linea_id = '22222222-2222-2222-2222-222222222222'),
  :'before_state'::jsonb,
  'generating a non-KPI-linked alert changes no indicador'
);

select * from finish();
rollback;
