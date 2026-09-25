-- Schema tests: tables, columns, enums, constraints, FKs, indexes.
begin;
select plan(46);

-- Fixtures: a real planta/linea so FK constraints never mask the CHECK
-- constraints under test below.
insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Línea Test', 'Turno mañana');

-- Enums -----------------------------------------------------------------
select has_type('public', 'severidad', 'severidad enum exists');
select has_type('public', 'estado_alerta', 'estado_alerta enum exists');
select enum_has_labels(
  'public', 'severidad', array['parar', 'atencion', 'ok'],
  'severidad has exactly parar, atencion, ok in that order'
);
select enum_has_labels(
  'public', 'estado_alerta', array['nueva', 'atendida', 'no_aplica'],
  'estado_alerta has exactly nueva, atendida, no_aplica'
);

-- Tables exist ------------------------------------------------------------
select has_table('public', 'plantas', 'plantas exists');
select has_table('public', 'lineas', 'lineas exists');
select has_table('public', 'estaciones', 'estaciones exists');
select has_table('public', 'usuarios', 'usuarios exists');
select has_table('public', 'usuarios_pin', 'usuarios_pin exists');
select has_table('public', 'intentos_login', 'intentos_login exists');
select has_table('public', 'sesiones', 'sesiones exists');
select has_table('public', 'indicadores', 'indicadores exists');
select has_table('public', 'alertas', 'alertas exists');
select has_table('public', 'plantillas_alerta', 'plantillas_alerta exists');

-- Key columns ---------------------------------------------------------------
select has_column('public', 'alertas', 'estado', 'alertas.estado exists');
select col_type_is('public', 'alertas', 'estado', 'estado_alerta', 'alertas.estado is estado_alerta');
select col_type_is('public', 'alertas', 'severidad', 'severidad', 'alertas.severidad is severidad');
select col_not_null('public', 'alertas', 'estado', 'alertas.estado is not null');
select col_not_null('public', 'alertas', 'linea_id', 'alertas.linea_id is not null');
select col_default_is('public', 'alertas', 'estado', 'nueva'::estado_alerta, 'alertas.estado defaults nueva');

select has_column('public', 'usuarios_pin', 'pin_hash', 'usuarios_pin.pin_hash exists');
select has_column('public', 'intentos_login', 'bloqueado_hasta', 'intentos_login.bloqueado_hasta exists');
select has_column('public', 'sesiones', 'fin', 'sesiones.fin exists');
select has_column('public', 'indicadores', 'valor', 'indicadores.valor exists');

-- Foreign keys ----------------------------------------------------------
select col_is_fk('public', 'lineas', 'planta_id', 'lineas.planta_id is a FK');
select col_is_fk('public', 'estaciones', 'linea_id', 'estaciones.linea_id is a FK');
select col_is_fk('public', 'usuarios', 'linea_id', 'usuarios.linea_id is a FK');
select col_is_fk('public', 'usuarios_pin', 'usuario_id', 'usuarios_pin.usuario_id is a FK');
select col_is_fk('public', 'sesiones', 'usuario_id', 'sesiones.usuario_id is a FK');
select col_is_fk('public', 'alertas', 'linea_id', 'alertas.linea_id is a FK');
select col_is_fk('public', 'alertas', 'resuelta_por', 'alertas.resuelta_por is a FK');

-- Uniques -----------------------------------------------------------------
select col_is_unique('public', 'lineas', array['planta_id', 'nombre'], 'lineas unique(planta_id, nombre)');
select col_is_unique('public', 'estaciones', array['linea_id', 'numero'], 'estaciones unique(linea_id, numero)');
select col_is_unique('public', 'indicadores', array['linea_id', 'clave'], 'indicadores unique(linea_id, clave)');
select col_is_unique('public', 'plantas', array['nombre'], 'plantas.nombre is unique');

-- Index for active-alerts-per-line lookup ----------------------------------
select has_index('public', 'alertas', 'alertas_linea_activas_idx', 'active-alerts index exists');
select has_index('public', 'sesiones', 'sesiones_usuario_inicio_idx', 'session lookup index exists');

-- CHECK constraints (behavioral, via throws_ok) ----------------------------
select throws_ok(
  $$ insert into public.usuarios (linea_id, nombre, iniciales, color)
     values ('22222222-2222-2222-2222-222222222222', 'X', 'XXXX', '#ffffff') $$,
  '23514',
  null,
  'usuarios.iniciales longer than 3 chars is rejected'
);

select throws_ok(
  $$ insert into public.usuarios (linea_id, nombre, iniciales, color)
     values ('22222222-2222-2222-2222-222222222222', 'X', 'X', 'red') $$,
  '23514',
  null,
  'usuarios.color must match ^#[0-9a-fA-F]{6}$'
);

select throws_ok(
  $$ insert into public.alertas (linea_id, severidad, titulo)
     values ('22222222-2222-2222-2222-222222222222', 'ok', repeat('x', 81)) $$,
  '23514',
  null,
  'alertas.titulo longer than 80 chars is rejected'
);

select throws_ok(
  $$ insert into public.alertas (linea_id, severidad, titulo, estado)
     values ('22222222-2222-2222-2222-222222222222', 'ok', 'sin resolver', 'atendida') $$,
  '23514',
  null,
  'alertas: estado atendida without resuelta_por/resuelta_en is rejected'
);

select throws_ok(
  $$ insert into public.estaciones (linea_id, numero, nombre)
     values ('22222222-2222-2222-2222-222222222222', 0, 'X') $$,
  '23514',
  null,
  'estaciones.numero must be > 0'
);

select throws_ok(
  $$ insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso)
     values ('ok', 'X', 1, '%', 10, 5, 90, 1) $$,
  '23514',
  null,
  'plantillas_alerta.valor_max must be >= valor_min'
);

select throws_ok(
  $$ insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso)
     values ('ok', 'X', 1, '%', 1, 5, 90, 0) $$,
  '23514',
  null,
  'plantillas_alerta.peso must be > 0'
);

-- A nueva alert accepts null resuelta_por/resuelta_en (no throw) -----------
select lives_ok(
  $$ insert into public.alertas (linea_id, severidad, titulo)
     values ('22222222-2222-2222-2222-222222222222', 'ok', 'nueva sin resolver') $$,
  'alertas: estado nueva with null resolution columns is allowed'
);

-- A no_aplica alert with resuelta_por null (system auto-resolve) is allowed
select lives_ok(
  $$ insert into public.alertas (linea_id, severidad, titulo, estado, resuelta_en)
     values ('22222222-2222-2222-2222-222222222222', 'ok', 'auto resuelta', 'no_aplica', now()) $$,
  'alertas: no_aplica with resuelta_por null (system) is allowed'
);

select * from finish();
rollback;
