-- resolver_alerta tests: atendida/no_aplica, idempotent, cross-line rejected,
-- invalid resolution rejected.
begin;
select plan(12);

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Línea A', 'Turno mañana'),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Línea B', 'Turno mañana');
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Ana Ríos', 'AR', '#2563eb');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('33333333-3333-3333-3333-333333333333', extensions.crypt('1234', extensions.gen_salt('bf')));

insert into public.alertas (id, linea_id, severidad, titulo) values
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'atencion', 'Alerta línea A'),
  ('a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222223', 'atencion', 'Alerta línea B');

select public.iniciar_sesion('33333333-3333-3333-3333-333333333333', '1234') \gset s_

-- Invalid resolution value is rejected --------------------------------------
select throws_ok(
  format($$ select public.resolver_alerta('%s', 'a0000000-0000-0000-0000-000000000001', 'nueva') $$, :'s_iniciar_sesion'),
  '22023',
  null,
  'resolver_alerta rejects a resolution other than atendida/no_aplica'
);

-- H2: NULL p_resolucion is rejected with the same errcode as an invalid one
-- (a bare `not in` comparison against NULL is unknown, not false, and would
-- silently skip the guard).
select throws_ok(
  format($$ select public.resolver_alerta('%s', 'a0000000-0000-0000-0000-000000000001', null) $$, :'s_iniciar_sesion'),
  '22023',
  null,
  'resolver_alerta rejects a NULL resolution with errcode 22023'
);

-- resolver_alerta on an invalid/expired session raises 28000 before any
-- other check (the session check runs first).
select throws_ok(
  $$ select public.resolver_alerta('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'atendida') $$,
  '28000',
  null,
  'resolver_alerta rejects an unknown session with errcode 28000'
);

-- Unknown alert id is reported as not found, same as a cross-line alert.
select throws_ok(
  format($$ select public.resolver_alerta('%s', '00000000-0000-0000-0000-000000000000', 'atendida') $$, :'s_iniciar_sesion'),
  'P0002',
  null,
  'resolver_alerta rejects an unknown alert id with errcode P0002'
);

-- Cross-line alert is reported as not found, not as forbidden ---------------
select throws_ok(
  format($$ select public.resolver_alerta('%s', 'a0000000-0000-0000-0000-000000000002', 'atendida') $$, :'s_iniciar_sesion'),
  'P0002',
  null,
  'resolver_alerta rejects an alert belonging to another line as not found'
);
select is(
  (select estado::text from public.alertas where id = 'a0000000-0000-0000-0000-000000000002'),
  'nueva',
  'the other line''s alert is untouched'
);

-- atendida sets resuelta_por/resuelta_en -------------------------------------
select public.resolver_alerta(:'s_iniciar_sesion', 'a0000000-0000-0000-0000-000000000001', 'atendida');
select is(
  (select estado::text from public.alertas where id = 'a0000000-0000-0000-0000-000000000001'),
  'atendida',
  'resolver_alerta atendida sets estado'
);
select is(
  (select resuelta_por from public.alertas where id = 'a0000000-0000-0000-0000-000000000001'),
  '33333333-3333-3333-3333-333333333333'::uuid,
  'resolver_alerta atendida records the resolving usuario'
);
select isnt(
  (select resuelta_en from public.alertas where id = 'a0000000-0000-0000-0000-000000000001'),
  null,
  'resolver_alerta atendida records resuelta_en'
);

-- Idempotent: resolving again (even with a different resolution) is a no-op
select lives_ok(
  format($$ select public.resolver_alerta('%s', 'a0000000-0000-0000-0000-000000000001', 'no_aplica') $$, :'s_iniciar_sesion'),
  'resolving an already-resolved alert again does not raise'
);
select is(
  (select estado::text from public.alertas where id = 'a0000000-0000-0000-0000-000000000001'),
  'atendida',
  'the already-resolved alert keeps its original resolution (idempotent)'
);

-- no_aplica on a fresh alert -------------------------------------------------
insert into public.alertas (id, linea_id, severidad, titulo)
  values ('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'ok', 'Otra alerta');
select public.resolver_alerta(:'s_iniciar_sesion', 'a0000000-0000-0000-0000-000000000004', 'no_aplica');
select is(
  (select estado::text from public.alertas where id = 'a0000000-0000-0000-0000-000000000004'),
  'no_aplica',
  'resolver_alerta no_aplica sets estado'
);

select * from finish();
rollback;
