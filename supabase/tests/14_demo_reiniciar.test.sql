-- G2: demo_reiniciar() restores the floor to its seeded state; demo_estado_lineas()
-- reports live per-line status for the back office.
begin;
select plan(19);

-- Isolate from any other test file's leftovers (same pattern as
-- 05_demo.test.sql): start from a clean slate of alerts, sessions and login
-- attempts before mutating.
delete from public.alertas;
delete from public.sesiones;
delete from public.intentos_login;

-- ---------------------------------------------------------------------------
-- Mutate everything demo_reiniciar() promises to restore.
-- ---------------------------------------------------------------------------

select id as usuario_id from public.usuarios where nombre = 'Ana Ríos' \gset ana_
select id as linea3_id from public.lineas where nombre = 'Línea 3 · Motores' \gset l3_

-- Seed the initial Línea 3 alerts (mirrors what a fresh `db reset` already
-- did via seed.sql -- explicit here since this test file cleared them).
select private.sembrar_alertas_linea3(:'l3_linea3_id');

-- Mutate: attend one alert, drop a KPI reading away from its seed value,
-- open + close a session (so "since last visit" state exists), and rack up
-- login attempts.
update public.alertas set estado = 'atendida', resuelta_en = now(), resuelta_por = :'ana_usuario_id'
where linea_id = :'l3_linea3_id' and titulo = 'Calibración completada';

update public.indicadores set valor = 12.3, actualizado_en = now()
where linea_id = :'l3_linea3_id' and clave = 'fpy';

select public.iniciar_sesion(:'ana_usuario_id', '1234') as sesion_id \gset s_
select public.cerrar_sesion(:'s_sesion_id');

insert into public.intentos_login (usuario_id, fallidos, bloqueado_hasta)
values (:'ana_usuario_id', 5, now() + interval '10 minutes')
on conflict (usuario_id) do update set fallidos = 5, bloqueado_hasta = now() + interval '10 minutes';

update public.demo_panel set ultima_simulacion = now(), alertas_generadas = 2
where linea_id = :'l3_linea3_id';

-- ---------------------------------------------------------------------------
-- demo_reiniciar()
-- ---------------------------------------------------------------------------

select lives_ok('select public.demo_reiniciar()', 'demo_reiniciar() runs without error');

select is(
  (select count(*)::int from public.alertas where linea_id = :'l3_linea3_id'),
  7,
  'Línea 3 is back to its 7 seeded alerts'
);
select is(
  (select count(*)::int from public.alertas where linea_id = :'l3_linea3_id' and estado = 'nueva'),
  7,
  'every restored alert is "nueva" (the earlier "atendida" mutation is gone)'
);
select is(
  (select valor from public.indicadores where linea_id = :'l3_linea3_id' and clave = 'fpy'),
  88.4::numeric,
  'reset restores the seeded FPY reading (parity with supabase/seed.sql)'
);
select is(
  (select valor from public.indicadores where linea_id = :'l3_linea3_id' and clave = 'dph'),
  5::numeric,
  'reset restores the seeded Defectos/hora reading'
);
select is(
  (select valor from public.indicadores where linea_id = :'l3_linea3_id' and clave = 'scrap'),
  1.6::numeric,
  'reset restores the seeded Scrap reading'
);
select is(
  (select count(*)::int from public.sesiones),
  0,
  'reset clears every session ("since last visit" starts fresh)'
);
select is(
  (select count(*)::int from public.intentos_login),
  0,
  'reset clears every login-lockout counter'
);
select is(
  (select ultima_simulacion from public.demo_panel where linea_id = :'l3_linea3_id'),
  null,
  'reset clears demo_panel last-simulation bookkeeping'
);

-- Never touches users/PINs.
select is(
  (select public.iniciar_sesion(:'ana_usuario_id', '1234') is not null),
  true,
  'reset never touches usuarios/usuarios_pin -- the same PIN still logs in'
);

select ok(
  not has_function_privilege('anon', 'public.demo_reiniciar()', 'execute'),
  'anon cannot execute demo_reiniciar'
);
select ok(
  not has_function_privilege('authenticated', 'public.demo_reiniciar()', 'execute'),
  'authenticated cannot execute demo_reiniciar'
);

-- ---------------------------------------------------------------------------
-- demo_estado_lineas()
-- ---------------------------------------------------------------------------

select is(
  jsonb_array_length(public.demo_estado_lineas()),
  (select count(*)::int from public.lineas),
  'demo_estado_lineas returns one row per line'
);

select is(
  (
    select e ->> 'estado'
    from jsonb_array_elements(public.demo_estado_lineas()) e
    where e ->> 'nombre' = 'Línea 3 · Motores'
  ),
  'parar',
  'Línea 3 reports "parar" (its two seeded parar alerts are the worst active severity)'
);
select is(
  (
    select (e ->> 'alertas_abiertas')::int
    from jsonb_array_elements(public.demo_estado_lineas()) e
    where e ->> 'nombre' = 'Línea 3 · Motores'
  ),
  7,
  'Línea 3 reports its 7 open alerts'
);
select is(
  (
    select e ->> 'estado'
    from jsonb_array_elements(public.demo_estado_lineas()) e
    where e ->> 'nombre' = 'Línea 1 · Chasis'
  ),
  'ok',
  'a line with no active alerts reports "ok"'
);

select public.demo_simular_turno_linea('Línea 3 · Motores', 1);
select ok(
  (
    select (e ->> 'alertas_abiertas')::int
    from jsonb_array_elements(public.demo_estado_lineas()) e
    where e ->> 'nombre' = 'Línea 3 · Motores'
  ) > 7,
  'demo_estado_lineas reflects a shift simulation'
);

select ok(
  not has_function_privilege('anon', 'public.demo_estado_lineas()', 'execute'),
  'anon cannot execute demo_estado_lineas'
);
select ok(
  not has_function_privilege('authenticated', 'public.demo_estado_lineas()', 'execute'),
  'authenticated cannot execute demo_estado_lineas'
);

select * from finish();
rollback;
