-- G3: demo_aplicar_escenario() applies one of the predefined back-office
-- scenarios (reset + a deterministic state); demo_estado_activo() reports
-- which one, if any, is currently considered exact.
begin;
select plan(28);

delete from public.alertas;
delete from public.sesiones;
delete from public.intentos_login;

select id as linea1_id from public.lineas where nombre = 'Línea 1 · Chasis' \gset l1_
select id as linea2_id from public.lineas where nombre = 'Línea 2 · Pintura' \gset l2_
select id as linea3_id from public.lineas where nombre = 'Línea 3 · Motores' \gset l3_

-- ---------------------------------------------------------------------------
-- Guards.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.demo_aplicar_escenario('no-existe')$$,
  '22023',
  null,
  'an unknown scenario id raises errcode 22023 (InvalidInputError mapping)'
);
select ok(
  not has_function_privilege('anon', 'public.demo_aplicar_escenario(text)', 'execute'),
  'anon cannot execute demo_aplicar_escenario'
);
select ok(
  not has_function_privilege('authenticated', 'public.demo_aplicar_escenario(text)', 'execute'),
  'authenticated cannot execute demo_aplicar_escenario'
);
select ok(
  not has_function_privilege('anon', 'public.demo_estado_activo()', 'execute'),
  'anon cannot execute demo_estado_activo'
);

select is(public.demo_estado_activo(), null, 'no scenario is active before any is applied');

-- ---------------------------------------------------------------------------
-- 'todo-ok': no open alerts anywhere, every KPI ok.
-- ---------------------------------------------------------------------------

select lives_ok($$select public.demo_aplicar_escenario('todo-ok')$$, 'todo-ok runs without error');
select is(public.demo_estado_activo(), 'todo-ok', 'demo_estado_activo reports todo-ok as active');
select is((select count(*)::int from public.alertas), 0, 'todo-ok: no open alerts on any line');
select is(
  (select count(*)::int from public.indicadores where estado <> 'ok'),
  0,
  'todo-ok: every KPI on every line is in the ok band'
);

-- ---------------------------------------------------------------------------
-- 'linea3-parar-alta': exactly one open ALTA (parar) alert on Línea 3, its
-- linked KPI held in parar, other lines ok (D25/D30).
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.demo_aplicar_escenario('linea3-parar-alta')$$,
  'linea3-parar-alta runs without error'
);
select is(public.demo_estado_activo(), 'linea3-parar-alta', 'demo_estado_activo reports linea3-parar-alta');
select is(
  (select count(*)::int from public.alertas where linea_id = :'l3_linea3_id' and estado = 'nueva'),
  1,
  'linea3-parar-alta: exactly one open alert on Línea 3'
);
select is(
  (select severidad::text from public.alertas where linea_id = :'l3_linea3_id' and estado = 'nueva'),
  'parar',
  'linea3-parar-alta: that alert is ALTA (severidad parar)'
);
select is(
  (select estado::text from public.indicadores where linea_id = :'l3_linea3_id' and clave = 'fpy'),
  'parar',
  'linea3-parar-alta: Línea 3''s fpy KPI is in the parar band'
);
select is(
  (select count(*)::int from public.alertas where linea_id in (:'l1_linea1_id', :'l2_linea2_id')),
  0,
  'linea3-parar-alta: other lines have no open alerts'
);
select is(
  (select count(*)::int from public.indicadores where linea_id in (:'l1_linea1_id', :'l2_linea2_id') and estado <> 'ok'),
  0,
  'linea3-parar-alta: other lines'' KPIs stay ok'
);

-- ---------------------------------------------------------------------------
-- 'muchas-media': many open MEDIA (atencion) alerts on Línea 3, no ALTA.
-- ---------------------------------------------------------------------------

select lives_ok($$select public.demo_aplicar_escenario('muchas-media')$$, 'muchas-media runs without error');
select is(public.demo_estado_activo(), 'muchas-media', 'demo_estado_activo reports muchas-media');
select cmp_ok(
  (select count(*)::int from public.alertas where linea_id = :'l3_linea3_id' and estado = 'nueva'),
  '>',
  3,
  'muchas-media: more than 3 open alerts on Línea 3 (drives the "+N alertas menos graves" overflow)'
);
select is(
  (select count(*)::int from public.alertas where linea_id = :'l3_linea3_id' and estado = 'nueva' and severidad = 'parar'),
  0,
  'muchas-media: none of them is ALTA (parar)'
);
select is(
  (select estado::text from public.indicadores where linea_id = :'l3_linea3_id' and clave = 'dph'),
  'atencion',
  'muchas-media: Línea 3''s defectos/hora KPI is held in atencion'
);

-- ---------------------------------------------------------------------------
-- 'recuperacion': Línea 3's alerts are already resolved, KPIs recovered.
-- ---------------------------------------------------------------------------

select lives_ok($$select public.demo_aplicar_escenario('recuperacion')$$, 'recuperacion runs without error');
select is(public.demo_estado_activo(), 'recuperacion', 'demo_estado_activo reports recuperacion');
select is(
  (select count(*)::int from public.alertas where linea_id = :'l3_linea3_id' and estado = 'nueva'),
  0,
  'recuperacion: no open alerts on Línea 3 (everything already resolved)'
);
select cmp_ok(
  (select count(*)::int from public.alertas where linea_id = :'l3_linea3_id' and estado in ('atendida', 'no_aplica')),
  '>',
  0,
  'recuperacion: at least one historical resolved alert exists'
);
select is(
  (select count(*)::int from public.indicadores where linea_id = :'l3_linea3_id' and estado <> 'ok'),
  0,
  'recuperacion: Línea 3''s KPIs are back to ok'
);

-- ---------------------------------------------------------------------------
-- Invalidation: a reset or a shift clears the active scenario.
-- ---------------------------------------------------------------------------

select public.demo_aplicar_escenario('todo-ok');
select public.demo_reiniciar();
select is(public.demo_estado_activo(), null, 'demo_reiniciar clears the active scenario (reset = "Estado inicial")');

select public.demo_aplicar_escenario('todo-ok');
select public.demo_simular_turno_linea('Línea 3 · Motores', 1);
select is(
  public.demo_estado_activo(),
  null,
  'a shift simulation clears the active scenario (no longer exact)'
);

select * from finish();
rollback;
