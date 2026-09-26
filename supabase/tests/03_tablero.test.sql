-- Tablero tests: shape, ordering, first-visit, second-visit nuevas_ids.
begin;
select plan(15);

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Línea Test', 'Turno mañana');
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Ana Ríos', 'AR', '#2563eb');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('33333333-3333-3333-3333-333333333333', extensions.crypt('1234', extensions.gen_salt('bf')));

insert into public.indicadores (linea_id, clave, nombre, valor, unidad, estado, detalle, orden)
  values ('22222222-2222-2222-2222-222222222222', 'fpy', 'FPY', 88.4, '%', 'parar', 'Rendimiento a primera pasada', 1);

insert into public.alertas (id, linea_id, severidad, titulo, creada_en)
  values
    ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'atencion', 'Defectos en aumento', now() - interval '10 minutes'),
    ('a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'parar', 'FPY bajo', now() - interval '5 minutes');

-- First visit: no prior closed session -> ultima_visita null, nuevas_ids empty
select public.iniciar_sesion('33333333-3333-3333-3333-333333333333', '1234') \gset first_
select is(
  (public.tablero(:'first_iniciar_sesion') ->> 'ultima_visita'),
  null,
  'first visit: ultima_visita is null'
);
select is(
  jsonb_array_length(public.tablero(:'first_iniciar_sesion') -> 'nuevas_ids'),
  0,
  'first visit: nuevas_ids is empty'
);
select is(
  (public.tablero(:'first_iniciar_sesion') -> 'usuario' ->> 'nombre'),
  'Ana Ríos',
  'tablero includes the logged-in usuario'
);
select is(
  (public.tablero(:'first_iniciar_sesion') -> 'linea' ->> 'nombre'),
  'Línea Test',
  'tablero includes the linea nombre'
);
select is(
  (public.tablero(:'first_iniciar_sesion') -> 'planta' ->> 'nombre'),
  'Planta Test',
  'tablero includes the planta nombre'
);
select is(
  jsonb_array_length(public.tablero(:'first_iniciar_sesion') -> 'alertas'),
  2,
  'tablero lists both active alerts'
);
select is(
  (public.tablero(:'first_iniciar_sesion') -> 'alertas' -> 0 ->> 'titulo'),
  'FPY bajo',
  'alertas are ordered by severity first: parar before atencion'
);
select is(
  jsonb_array_length(public.tablero(:'first_iniciar_sesion') -> 'indicadores'),
  1,
  'tablero lists the linea indicadores'
);

select public.cerrar_sesion(:'first_iniciar_sesion');

-- Add a new alert after the first visit closed, then log in again. Uses
-- clock_timestamp() (real wall-clock time), not now(): the whole test file
-- runs inside one transaction, where now() is frozen at BEGIN and would
-- equal (not exceed) the fin timestamp cerrar_sesion just set with now().
insert into public.alertas (id, linea_id, severidad, titulo, creada_en)
  values ('a0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'ok', 'Nueva tras visita', clock_timestamp());

select public.iniciar_sesion('33333333-3333-3333-3333-333333333333', '1234') \gset second_
select isnt(
  (public.tablero(:'second_iniciar_sesion') ->> 'ultima_visita'),
  null,
  'second visit: ultima_visita is set from the previous session close'
);
select is(
  jsonb_array_length(public.tablero(:'second_iniciar_sesion') -> 'nuevas_ids'),
  1,
  'second visit: exactly the alert created after the last visit is new'
);
select is(
  (public.tablero(:'second_iniciar_sesion') -> 'nuevas_ids' -> 0),
  to_jsonb('a0000000-0000-0000-0000-000000000003'::text),
  'second visit: nuevas_ids contains the newly created alert id'
);

-- H3: a previous session that expired without `fin` (12h timeout, never
-- closed by cerrar_sesion) still counts as a last visit. Its effective end
-- is inicio + private.duracion_sesion(), not "never visited". Uses a fresh
-- linea/user so Ana Ríos' more recent sessions and Línea Test's other
-- alertas above cannot leak into nuevas_ids or outrank the expired session.
insert into public.lineas (id, planta_id, nombre, turno)
  values ('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', 'Línea Expiry', 'Turno mañana');
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('33333333-3333-3333-3333-333333333334', '22222222-2222-2222-2222-222222222224', 'Uso Expirado', 'UE', '#334455');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('33333333-3333-3333-3333-333333333334', extensions.crypt('4321', extensions.gen_salt('bf')));
insert into public.sesiones (id, usuario_id, inicio)
  values (
    '99999999-9999-9999-9999-999999999999',
    '33333333-3333-3333-3333-333333333334',
    now() - interval '20 hours'
  );
insert into public.alertas (id, linea_id, severidad, titulo, creada_en)
  values (
    'a0000000-0000-0000-0000-000000000005',
    '22222222-2222-2222-2222-222222222224',
    'ok',
    'Tras sesión expirada',
    now() - interval '7 hours' -- after the expired session's effective end (20h - 12h = 8h ago)
  );
select public.iniciar_sesion('33333333-3333-3333-3333-333333333334', '4321') \gset third_
select is(
  (public.tablero(:'third_iniciar_sesion') ->> 'ultima_visita')::timestamptz,
  (now() - interval '20 hours' + interval '12 hours'),
  'third visit: ultima_visita is the expired session''s inicio + duracion_sesion(), not its (null) fin'
);
select is(
  jsonb_array_length(public.tablero(:'third_iniciar_sesion') -> 'nuevas_ids'),
  1,
  'third visit: nuevas_ids is computed against the expired session''s effective end time'
);

-- J1: an open, unexpired parallel session (e.g. another device/tab still
-- logged in) must never count as "the previous visit" -- only a CLOSED
-- session (fin not null) or an EXPIRED one (inicio + duracion_sesion() <=
-- now()) can. Fresh linea/user so the earlier blocks' sessions/alerts cannot
-- leak in. Two prior sessions exist for this user: an older CLOSED one, and
-- a more recent OPEN, unexpired one (started 1 minute ago) that must be
-- ignored entirely, not merely outranked.
insert into public.lineas (id, planta_id, nombre, turno)
  values ('22222222-2222-2222-2222-222222222225', '11111111-1111-1111-1111-111111111111', 'Línea Paralela', 'Turno mañana');
insert into public.usuarios (id, linea_id, nombre, iniciales, color)
  values ('33333333-3333-3333-3333-333333333335', '22222222-2222-2222-2222-222222222225', 'Uso Paralelo', 'UP', '#556677');
insert into public.usuarios_pin (usuario_id, pin_hash)
  values ('33333333-3333-3333-3333-333333333335', extensions.crypt('1111', extensions.gen_salt('bf')));

insert into public.sesiones (id, usuario_id, inicio, fin)
  values (
    '99999999-9999-9999-9999-999999999998',
    '33333333-3333-3333-3333-333333333335',
    now() - interval '3 hours',
    now() - interval '2 hours'
  );
insert into public.sesiones (id, usuario_id, inicio, fin)
  values (
    '99999999-9999-9999-9999-999999999997',
    '33333333-3333-3333-3333-333333333335',
    now() - interval '1 minute',
    null
  );
insert into public.alertas (id, linea_id, severidad, titulo, creada_en)
  values (
    'a0000000-0000-0000-0000-000000000006',
    '22222222-2222-2222-2222-222222222225',
    'ok',
    'Tras cierre con sesión paralela abierta',
    now() - interval '90 minutes'
  );

select public.iniciar_sesion('33333333-3333-3333-3333-333333333335', '1111') \gset fourth_
select is(
  (public.tablero(:'fourth_iniciar_sesion') ->> 'ultima_visita')::timestamptz,
  (now() - interval '2 hours'),
  'fourth visit: an open, unexpired parallel session is ignored; ultima_visita comes from the older closed session'
);
select is(
  jsonb_array_length(public.tablero(:'fourth_iniciar_sesion') -> 'nuevas_ids'),
  1,
  'fourth visit: nuevas_ids is computed against the older closed session''s end, not the open parallel one'
);

select * from finish();
rollback;
