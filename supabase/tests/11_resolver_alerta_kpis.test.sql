-- D24: resolving an alert (Atendida / No aplica) never changes any KPI.
-- Kept as its own file/commit (see progress log) because it is a pure
-- proof: no source change accompanies it, resolver_alerta was never
-- touched by the Phase D migrations.
begin;
select plan(2);

update public.alertas set estado = 'no_aplica', resuelta_en = now() where estado = 'nueva';

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Línea Test', 'Turno mañana');
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

select (
  select jsonb_agg(jsonb_build_object('clave', clave, 'valor', valor, 'estado', estado, 'actualizado_en', actualizado_en) order by clave)
  from public.indicadores where linea_id = '22222222-2222-2222-2222-222222222222'
) as pre_resolve \gset

insert into public.alertas (id, linea_id, severidad, titulo)
  values ('a0000000-0000-0000-0000-0000000000f1', '22222222-2222-2222-2222-222222222222', 'atencion', 'Alerta a resolver');
select public.resolver_alerta(:'s_iniciar_sesion', 'a0000000-0000-0000-0000-0000000000f1', 'atendida');
select is(
  (select jsonb_agg(jsonb_build_object('clave', clave, 'valor', valor, 'estado', estado, 'actualizado_en', actualizado_en) order by clave)
     from public.indicadores where linea_id = '22222222-2222-2222-2222-222222222222'),
  :'pre_resolve'::jsonb,
  'resolver_alerta (atendida) never changes any indicador (valor, estado, actualizado_en)'
);

insert into public.alertas (id, linea_id, severidad, titulo)
  values ('a0000000-0000-0000-0000-0000000000f2', '22222222-2222-2222-2222-222222222222', 'atencion', 'Otra alerta a resolver');
select public.resolver_alerta(:'s_iniciar_sesion', 'a0000000-0000-0000-0000-0000000000f2', 'no_aplica');
select is(
  (select jsonb_agg(jsonb_build_object('clave', clave, 'valor', valor, 'estado', estado, 'actualizado_en', actualizado_en) order by clave)
     from public.indicadores where linea_id = '22222222-2222-2222-2222-222222222222'),
  :'pre_resolve'::jsonb,
  'resolver_alerta (no_aplica) never changes any indicador (valor, estado, actualizado_en)'
);

select * from finish();
rollback;
