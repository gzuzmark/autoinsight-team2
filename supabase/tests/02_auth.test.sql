-- Auth tests: iniciar_sesion success/failure/lockout/reset, session expiry.
begin;
select plan(25);

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
