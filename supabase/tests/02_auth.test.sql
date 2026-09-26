-- Auth tests: iniciar_sesion success/failure/lockout/reset, session expiry.
begin;
select plan(46);

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Línea Test', 'Turno mañana');
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Ana Ríos', 'AR', '#2563eb');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('33333333-3333-3333-3333-333333333333', extensions.crypt('1234', extensions.gen_salt('bf')));

-- Wrong PIN fails and returns null, does not create a session --------------
select is(public.iniciar_sesion('33333333-3333-3333-3333-333333333333', '0000'), null, 'wrong PIN returns null');
select is((select fallidos from public.intentos_login where usuario_id = '33333333-3333-3333-3333-333333333333'), 1, 'one failed attempt is recorded');

-- NULL PIN never authenticates and counts as a failure ------------------------
select is(public.iniciar_sesion('33333333-3333-3333-3333-333333333333', null), null, 'null PIN returns null');
select is((select fallidos from public.intentos_login where usuario_id = '33333333-3333-3333-3333-333333333333'), 2, 'a null PIN is recorded as a failed attempt');

-- Unknown user fails the same way (no enumeration) --------------------------
select is(public.iniciar_sesion('99999999-9999-9999-9999-999999999999', '1234'), null, 'unknown user returns null, same as a wrong PIN');

-- Correct PIN succeeds and opens a session -----------------------------------
select isnt(public.iniciar_sesion('33333333-3333-3333-3333-333333333333', '1234'), null, 'correct PIN returns a session id');
select is((select fallidos from public.intentos_login where usuario_id = '33333333-3333-3333-3333-333333333333'), 0, 'a successful login resets the failure counter');

select is(
  (select count(*)::int from public.sesiones where usuario_id = '33333333-3333-3333-3333-333333333333' and fin is null),
  1,
  'exactly one open session exists for the user'
);

-- Lockout: 5 consecutive failures locks the user out -------------------------
select public.iniciar_sesion('33333333-3333-3333-3333-333333333333', 'aaaa');
select public.iniciar_sesion('33333333-3333-3333-3333-333333333333', 'bbbb');
select public.iniciar_sesion('33333333-3333-3333-3333-333333333333', 'cccc');
select public.iniciar_sesion('33333333-3333-3333-3333-333333333333', 'dddd');
select is(public.iniciar_sesion('33333333-3333-3333-3333-333333333333', 'eeee'), null, '5th consecutive failure still returns null');
select is(
  (select fallidos from public.intentos_login where usuario_id = '33333333-3333-3333-3333-333333333333'),
  5,
  'failure counter reaches 5'
);
select ok(
  (select bloqueado_hasta from public.intentos_login where usuario_id = '33333333-3333-3333-3333-333333333333') > now(),
  'user is locked out after 5 consecutive failures'
);

-- Locked out: even the correct PIN is rejected while locked ------------------
select is(
  public.iniciar_sesion('33333333-3333-3333-3333-333333333333', '1234'),
  null,
  'correct PIN is rejected while locked out'
);

-- Inactive user cannot log in even with the correct PIN ----------------------
insert into public.usuarios (id, linea_id, nombre, iniciales, color, activo)
  values ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Inactivo', 'IN', '#000000', false);
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('44444444-4444-4444-4444-444444444444', extensions.crypt('9999', extensions.gen_salt('bf')));
select is(public.iniciar_sesion('44444444-4444-4444-4444-444444444444', '9999'), null, 'inactive user cannot log in');

-- Session expiry: a session older than 12h is invalid ------------------------
insert into public.sesiones (id, usuario_id, inicio)
  values ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', now() - interval '13 hours');
select throws_ok(
  $$ select public.tablero('55555555-5555-5555-5555-555555555555') $$,
  '28000',
  null,
  'tablero rejects an expired session (older than 12h) with errcode 28000'
);

-- H7: tablero rejects an already-closed session (fin is not null) ----------
insert into public.sesiones (id, usuario_id, fin)
  values ('55555555-5555-5555-5555-555555555556', '33333333-3333-3333-3333-333333333333', now());
select throws_ok(
  $$ select public.tablero('55555555-5555-5555-5555-555555555556') $$,
  '28000',
  null,
  'tablero rejects a closed session with errcode 28000'
);

-- H7: tablero rejects a session whose user was deactivated afterwards ------
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'Se Va', 'SV', '#111111');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('77777777-7777-7777-7777-777777777777', extensions.crypt('5555', extensions.gen_salt('bf')));
select public.iniciar_sesion('77777777-7777-7777-7777-777777777777', '5555') \gset deact_
update public.usuarios set activo = false where id = '77777777-7777-7777-7777-777777777777';
select throws_ok(
  format($$ select public.tablero('%s') $$, :'deact_iniciar_sesion'),
  '28000',
  null,
  'tablero rejects a session belonging to a now-deactivated user'
);

-- H5: a lock reset to the past no longer blocks, and the next failure -------
-- starts counting from zero again instead of relocking immediately.
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', 'Bloqueado', 'BL', '#222222');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('88888888-8888-8888-8888-888888888888', extensions.crypt('6666', extensions.gen_salt('bf')));
insert into public.intentos_login (usuario_id, fallidos, bloqueado_hasta)
  values ('88888888-8888-8888-8888-888888888888', 5, now() - interval '1 minute');
select is(
  public.iniciar_sesion('88888888-8888-8888-8888-888888888888', 'wrong'),
  null,
  'an expired lock still rejects a wrong PIN'
);
select is(
  (select fallidos from public.intentos_login where usuario_id = '88888888-8888-8888-8888-888888888888'),
  1,
  'the failure counter restarts at 1 after the lock expired, not 6'
);
select is(
  (select bloqueado_hasta from public.intentos_login where usuario_id = '88888888-8888-8888-8888-888888888888'),
  null,
  'the lock is not re-armed by a single failure after it expired'
);
select isnt(
  public.iniciar_sesion('88888888-8888-8888-8888-888888888888', '6666'),
  null,
  'the correct PIN succeeds right after an expired lock resets the counter'
);

-- H5: public.desbloquear_usuario clears a lockout unconditionally ----------
-- J4: also clears the consecutive-lock escalation counter (bloqueos).
insert into public.intentos_login (usuario_id, fallidos, bloqueado_hasta, bloqueos)
  values ('44444444-4444-4444-4444-444444444444', 5, now() + interval '5 minutes', 4)
  on conflict (usuario_id) do update set fallidos = 5, bloqueado_hasta = now() + interval '5 minutes', bloqueos = 4;
select public.desbloquear_usuario('44444444-4444-4444-4444-444444444444');
select is(
  (select fallidos from public.intentos_login where usuario_id = '44444444-4444-4444-4444-444444444444'),
  0,
  'desbloquear_usuario resets the failure counter'
);
select is(
  (select bloqueado_hasta from public.intentos_login where usuario_id = '44444444-4444-4444-4444-444444444444'),
  null,
  'desbloquear_usuario clears bloqueado_hasta'
);
select is(
  (select bloqueos from public.intentos_login where usuario_id = '44444444-4444-4444-4444-444444444444'),
  0,
  'desbloquear_usuario resets the consecutive-lock counter (bloqueos)'
);

-- J4: escalating lockout -----------------------------------------------------
select is(
  private.duracion_bloqueo_escalada(1),
  interval '5 minutes',
  'the first consecutive lock lasts exactly the base lockout duration'
);
select is(
  private.duracion_bloqueo_escalada(2),
  interval '10 minutes',
  'the second consecutive lock duration doubles'
);
select is(
  private.duracion_bloqueo_escalada(20),
  interval '60 minutes',
  'lock duration is capped at 60 minutes however many consecutive locks precede it'
);

insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Escalado Uno', 'EU', '#663311');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', extensions.crypt('7777', extensions.gen_salt('bf')));

select public.iniciar_sesion('cccccccc-cccc-cccc-cccc-cccccccccccc', 'w1');
select public.iniciar_sesion('cccccccc-cccc-cccc-cccc-cccccccccccc', 'w2');
select public.iniciar_sesion('cccccccc-cccc-cccc-cccc-cccccccccccc', 'w3');
select public.iniciar_sesion('cccccccc-cccc-cccc-cccc-cccccccccccc', 'w4');
select public.iniciar_sesion('cccccccc-cccc-cccc-cccc-cccccccccccc', 'w5');
select is(
  (select bloqueos from public.intentos_login where usuario_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  1,
  'the first lock sets bloqueos to 1'
);
select ok(
  (select bloqueado_hasta from public.intentos_login where usuario_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')
    between now() + interval '4 minutes 55 seconds' and now() + interval '5 minutes 5 seconds',
  'the first lock lasts approximately the base 5 minutes'
);

-- Simulate the first lock having expired, then a second run of 5 failures.
update public.intentos_login
set bloqueado_hasta = now() - interval '1 minute'
where usuario_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
select public.iniciar_sesion('cccccccc-cccc-cccc-cccc-cccccccccccc', 'w1');
select public.iniciar_sesion('cccccccc-cccc-cccc-cccc-cccccccccccc', 'w2');
select public.iniciar_sesion('cccccccc-cccc-cccc-cccc-cccccccccccc', 'w3');
select public.iniciar_sesion('cccccccc-cccc-cccc-cccc-cccccccccccc', 'w4');
select public.iniciar_sesion('cccccccc-cccc-cccc-cccc-cccccccccccc', 'w5');
select is(
  (select bloqueos from public.intentos_login where usuario_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  2,
  'a second consecutive lock (after the first one expired) escalates bloqueos to 2'
);
select ok(
  (select bloqueado_hasta from public.intentos_login where usuario_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')
    between now() + interval '9 minutes 55 seconds' and now() + interval '10 minutes 5 seconds',
  'the second consecutive lock lasts approximately double: 10 minutes'
);

-- A successful login resets bloqueos regardless of prior escalation history.
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'Escalado Reset', 'ER', '#334422');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('dddddddd-dddd-dddd-dddd-dddddddddddd', extensions.crypt('8888', extensions.gen_salt('bf')));
insert into public.intentos_login (usuario_id, fallidos, bloqueado_hasta, bloqueos)
  values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 0, null, 3);
select isnt(
  public.iniciar_sesion('dddddddd-dddd-dddd-dddd-dddddddddddd', '8888'),
  null,
  'a successful login succeeds regardless of prior escalation history'
);
select is(
  (select bloqueos from public.intentos_login where usuario_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  0,
  'a successful login resets the consecutive-lock counter (bloqueos)'
);
select ok(
  not has_function_privilege('anon', 'public.desbloquear_usuario(uuid)', 'execute'),
  'anon cannot execute desbloquear_usuario'
);
select ok(
  not has_function_privilege('authenticated', 'public.desbloquear_usuario(uuid)', 'execute'),
  'authenticated cannot execute desbloquear_usuario'
);
select ok(
  has_function_privilege('service_role', 'public.desbloquear_usuario(uuid)', 'execute'),
  'service_role can execute desbloquear_usuario'
);

-- No EXECUTE on any RPC for anon/authenticated -------------------------------
select ok(
  not has_function_privilege('anon', 'public.iniciar_sesion(uuid, text)', 'execute'),
  'anon cannot execute iniciar_sesion'
);
select ok(
  not has_function_privilege('anon', 'public.cerrar_sesion(uuid)', 'execute'),
  'anon cannot execute cerrar_sesion'
);
select ok(
  not has_function_privilege('anon', 'public.tablero(uuid)', 'execute'),
  'anon cannot execute tablero'
);
select ok(
  not has_function_privilege('anon', 'public.resolver_alerta(uuid, uuid, estado_alerta)', 'execute'),
  'anon cannot execute resolver_alerta'
);
select ok(
  not has_function_privilege('anon', 'public.demo_generar_alertas(uuid, int)', 'execute'),
  'anon cannot execute demo_generar_alertas'
);
select ok(
  not has_function_privilege('anon', 'public.demo_autoresolver(interval)', 'execute'),
  'anon cannot execute demo_autoresolver'
);
select ok(
  not has_function_privilege('anon', 'public.usuarios_login()', 'execute'),
  'anon cannot execute usuarios_login'
);
select ok(
  not has_function_privilege('authenticated', 'public.iniciar_sesion(uuid, text)', 'execute'),
  'authenticated cannot execute iniciar_sesion'
);
select ok(
  not has_function_privilege('authenticated', 'public.resolver_alerta(uuid, uuid, estado_alerta)', 'execute'),
  'authenticated cannot execute resolver_alerta'
);

select ok(
  has_function_privilege('service_role', 'public.iniciar_sesion(uuid, text)', 'execute'),
  'service_role can execute iniciar_sesion'
);
select ok(
  has_function_privilege('service_role', 'public.tablero(uuid)', 'execute'),
  'service_role can execute tablero'
);

select * from finish();
rollback;
