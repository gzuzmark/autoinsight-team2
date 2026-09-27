-- Phase D (D26): "recovery reading". demo_simular_turno and
-- demo_autoresolver each move every indicador of the affected line that did
-- NOT just get a new bad reading one state toward ok.
begin;
select plan(4);

update public.alertas set estado = 'no_aplica', resuelta_en = now() where estado = 'nueva';
delete from public.plantillas_alerta;

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Línea Test', 'Turno mañana');
insert into public.estaciones (linea_id, numero, nombre)
  values ('22222222-2222-2222-2222-222222222222', 1, 'Ensamble');
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Ana Ríos', 'AR', '#2563eb');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('33333333-3333-3333-3333-333333333333', extensions.crypt('1234', extensions.gen_salt('bf')));

insert into public.indicadores
  (linea_id, clave, nombre, valor, unidad, mayor_es_mejor, umbral_atencion, umbral_parar, detalle, orden)
values
  ('22222222-2222-2222-2222-222222222222', 'fpy', 'FPY', 88.4, '%', true, 92, 90, 'Rendimiento a primera pasada', 1),
  ('22222222-2222-2222-2222-222222222222', 'dph', 'Defectos / hora', 5, 'defectos/h', false, 4, 6, 'Umbral de atención 4-6', 2),
  ('22222222-2222-2222-2222-222222222222', 'scrap', 'Scrap', 1.6, '%', false, 2, 3, 'Dentro del objetivo (<= 2 %)', 3);

select public.iniciar_sesion('33333333-3333-3333-3333-333333333333', '1234') \gset s_

-- ---------------------------------------------------------------------------
-- demo_simular_turno recovery: KPIs not hit by the new reading move one
-- state toward ok; the KPI that WAS hit keeps the new reading's state.
-- ---------------------------------------------------------------------------

insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso, indicador_clave, lectura_min, lectura_max)
  values ('atencion', 'Defectos por hora en aumento', 1, 'defectos/h', 7, 7, 4, 1, 'dph', 7, 7);

select public.demo_simular_turno(:'s_iniciar_sesion', 1);

select is(
  (select estado from public.indicadores where linea_id = '22222222-2222-2222-2222-222222222222' and clave = 'dph'),
  'parar'::public.severidad,
  'the KPI hit by the generated alert keeps the new (worse) reading, unaffected by recovery'
);
select is(
  (select estado from public.indicadores where linea_id = '22222222-2222-2222-2222-222222222222' and clave = 'fpy'),
  'atencion'::public.severidad,
  'a non-hit parar KPI recovers one step to atencion'
);
select is(
  (select estado from public.indicadores where linea_id = '22222222-2222-2222-2222-222222222222' and clave = 'scrap'),
  'ok'::public.severidad,
  'a non-hit ok KPI stays ok'
);

-- ---------------------------------------------------------------------------
-- demo_autoresolver recovery: closing stale alerts on a line refreshes
-- every KPI on that line one step toward ok.
-- ---------------------------------------------------------------------------

update public.indicadores set valor = 90.1, actualizado_en = now() - interval '1 hour'
  where linea_id = '22222222-2222-2222-2222-222222222222' and clave = 'fpy';
insert into public.alertas (id, linea_id, severidad, titulo, creada_en)
  values ('a0000000-0000-0000-0000-0000000000f3', '22222222-2222-2222-2222-222222222222', 'ok', 'Vieja para autoresolver', now() - interval '1 hour');

select public.demo_autoresolver('30 minutes'::interval);

select is(
  (select estado from public.indicadores where linea_id = '22222222-2222-2222-2222-222222222222' and clave = 'fpy'),
  'ok'::public.severidad,
  'demo_autoresolver''s recovery moves an atencion KPI on the affected line to ok'
);

select * from finish();
rollback;
