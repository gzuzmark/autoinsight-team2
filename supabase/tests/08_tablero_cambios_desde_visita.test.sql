-- K2: tablero.cambios_desde_visita. Counts ALL alerts on the line created
-- after ultima_visita, regardless of estado (unlike nuevas_ids, which is
-- active-only) -- so the client can tell "nothing ever changed" (0) apart
-- from "something changed but every new alert has since been resolved"
-- (> 0, with an empty nuevas_ids intersection against active alerts). See
-- the F1 regression this fixes: without this field, resolving every new
-- alert made the since-last-visit strip wrongly claim "Sin cambios".
begin;
select plan(4);

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Línea Test', 'Turno mañana');
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Ana Ríos', 'AR', '#2563eb');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('33333333-3333-3333-3333-333333333333', extensions.crypt('1234', extensions.gen_salt('bf')));

-- First visit: no prior closed session -> cambios_desde_visita is 0 --------
select public.iniciar_sesion('33333333-3333-3333-3333-333333333333', '1234') \gset first_
select is(
  (public.tablero(:'first_iniciar_sesion') ->> 'cambios_desde_visita')::int,
  0,
  'first visit: cambios_desde_visita is 0'
);
select public.cerrar_sesion(:'first_iniciar_sesion');

-- After the first visit closed, one alert is created and then resolved
-- before the second visit -- cambios_desde_visita still counts it (any
-- estado), even though it is no longer active and therefore absent from
-- nuevas_ids. Uses clock_timestamp() (real wall-clock time), matching
-- 03_tablero.test.sql's own pattern: the whole file runs in one
-- transaction, where now() is frozen at BEGIN and would equal (not exceed)
-- the fin timestamp cerrar_sesion just set with now().
insert into public.alertas (id, linea_id, severidad, titulo, creada_en)
  values ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'atencion', 'Resuelta antes de la visita', clock_timestamp());
update public.alertas set estado = 'atendida', resuelta_por = '33333333-3333-3333-3333-333333333333', resuelta_en = clock_timestamp()
  where id = 'a0000000-0000-0000-0000-000000000001';

select public.iniciar_sesion('33333333-3333-3333-3333-333333333333', '1234') \gset second_
select is(
  (public.tablero(:'second_iniciar_sesion') ->> 'cambios_desde_visita')::int,
  1,
  'cambios_desde_visita counts an alert created after the last visit even though it is already resolved'
);
select is(
  jsonb_array_length(public.tablero(:'second_iniciar_sesion') -> 'nuevas_ids'),
  0,
  'nuevas_ids stays empty for the same resolved alert (active-only, unlike cambios_desde_visita)'
);
select public.cerrar_sesion(:'second_iniciar_sesion');

-- A still-active alert created since the last visit: both fields agree.
-- Fresh linea/usuario (like 03_tablero.test.sql's own H3/J1 blocks): every
-- `cerrar_sesion` in this file sets fin = now(), which is FROZEN at
-- transaction BEGIN, so it is always earlier than any later
-- clock_timestamp()-created row -- chaining a third login+alert onto Ana
-- Ríos' existing session history above would make BOTH her earlier
-- resolved alert and this new one compare as "after" that frozen fin,
-- which is exactly the ambiguity a fresh user avoids.
insert into public.lineas (id, planta_id, nombre, turno)
  values ('22222222-2222-2222-2222-222222222226', '11111111-1111-1111-1111-111111111111', 'Línea Activa', 'Turno mañana');
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('33333333-3333-3333-3333-333333333336', '22222222-2222-2222-2222-222222222226', 'Uso Activo', 'UA', '#778899');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('33333333-3333-3333-3333-333333333336', extensions.crypt('2222', extensions.gen_salt('bf')));

select public.iniciar_sesion('33333333-3333-3333-3333-333333333336', '2222') \gset activa_first_
select public.cerrar_sesion(:'activa_first_iniciar_sesion');

insert into public.alertas (id, linea_id, severidad, titulo, creada_en)
  values ('a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222226', 'ok', 'Aun activa', clock_timestamp());
select public.iniciar_sesion('33333333-3333-3333-3333-333333333336', '2222') \gset activa_second_
select is(
  (public.tablero(:'activa_second_iniciar_sesion') ->> 'cambios_desde_visita')::int,
  1,
  'cambios_desde_visita counts the still-active alert created since the last visit'
);

select * from finish();
rollback;
