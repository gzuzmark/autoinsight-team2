-- K1: demo_simular_turno tests. "Simular turno" (the demo shift-simulation
-- button) must generate alerts on the CALLING SESSION'S OWN line, not a
-- random line -- before this RPC existed, the adapter called
-- demo_generar_alertas(p_cantidad: 2) with p_linea_id omitted, which picks a
-- random line per alert, so the operator's own dashboard often looked
-- unchanged after "Simular turno".
begin;
select plan(9);

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Línea A', 'Turno mañana'),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Línea B', 'Turno mañana');
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Ana Ríos', 'AR', '#2563eb');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('33333333-3333-3333-3333-333333333333', extensions.crypt('1234', extensions.gen_salt('bf')));
insert into public.estaciones (linea_id, numero, nombre)
  values ('22222222-2222-2222-2222-222222222222', 1, 'Ensamble');

-- Isolate from supabase/seed.sql's template catalog, matching the pattern
-- used in 05_demo.test.sql: exactly one candidate template so the weighted
-- pick is deterministic.
delete from public.plantillas_alerta;
insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso)
  values ('parar', 'Paro de línea por fuga de aire', 1, '%', 0, 100, 90, 1);

-- Invalid/unknown session raises 28000, same as every other RPC that takes
-- a p_sesion_id -----------------------------------------------------------
select throws_ok(
  $$ select public.demo_simular_turno('00000000-0000-0000-0000-000000000000', 2) $$,
  '28000',
  null,
  'demo_simular_turno rejects an unknown session with errcode 28000'
);

select public.iniciar_sesion('33333333-3333-3333-3333-333333333333', '1234') \gset s_

-- Generates on the session user's OWN line, never a random other line -----
select is(
  (select count(*)::int from public.demo_simular_turno(:'s_iniciar_sesion', 1)),
  1,
  'demo_simular_turno inserts one alert for cantidad = 1'
);
select is(
  (select count(*)::int from public.alertas
     where linea_id = '22222222-2222-2222-2222-222222222222' and estado = 'nueva'),
  1,
  'the generated alert lands on the session user''s own line'
);
select is(
  (select count(*)::int from public.alertas
     where linea_id = '22222222-2222-2222-2222-222222222223' and estado = 'nueva'),
  0,
  'no alert was generated on another line'
);

-- Default p_cantidad is 2 ----------------------------------------------------
insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso)
  values ('atencion', 'Nivel de adhesivo bajo', 1, '%', 0, 100, 20, 1);
-- K5: only 1 template is available but 2 are requested, so the oldest active
-- template alert on the line is closed as no_aplica by the system first.
select is(
  (select count(*)::int from public.demo_simular_turno(:'s_iniciar_sesion')),
  2,
  'demo_simular_turno with default p_cantidad (2) frees room on a saturated line and generates 2'
);
select is(
  (select count(*)::int from public.alertas
     where linea_id = '22222222-2222-2222-2222-222222222222'
       and estado = 'no_aplica' and resuelta_por is null and resuelta_en is not null),
  1,
  'the oldest active alert was closed as no_aplica by the system'
);
select is(
  (select count(*)::int from public.demo_simular_turno(:'s_iniciar_sesion', 2)),
  2,
  'a fully saturated line (every template active) still generates the requested alerts'
);
select is(
  (select count(*)::int from public.alertas
     where linea_id = '22222222-2222-2222-2222-222222222222' and estado = 'nueva'),
  2,
  'the line keeps a bounded number of active demo alerts'
);

-- anon cannot execute ---------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.demo_simular_turno(uuid, int)', 'execute'),
  'anon cannot execute demo_simular_turno'
);

select * from finish();
rollback;
