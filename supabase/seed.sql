-- Local seed data (B5): Planta Norte, 3 lines, stations, the 6 mock users
-- (same names/iniciales/colors/PINs as lib/mock-data.ts, PINs hashed here
-- with bcrypt via extensions.crypt), per-line KPIs and a starting set of
-- active alerts on Línea 3 matching the mock ALERTAS_INICIALES, plus a
-- simulator template catalog for demo_generar_alertas.
--
-- This file only runs against the LOCAL database (supabase db reset loads
-- it automatically, see supabase/config.toml [db.seed]). It never touches
-- the remote project.

begin;

insert into public.plantas (id, nombre) values
  ('00000000-0000-0000-0000-000000000001', 'Planta Norte');

insert into public.lineas (id, planta_id, nombre, turno) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Línea 1 · Chasis', 'Turno mañana'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Línea 2 · Pintura', 'Turno mañana'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Línea 3 · Motores', 'Turno mañana');

-- Stations on Línea 3, matching the stations referenced by the mock alerts
-- and simulator templates in lib/mock-data.ts.
insert into public.estaciones (linea_id, numero, nombre) values
  ('00000000-0000-0000-0000-000000000013', 1, 'Recepción'),
  ('00000000-0000-0000-0000-000000000013', 2, 'Soldadura'),
  ('00000000-0000-0000-0000-000000000013', 3, 'Inspección'),
  ('00000000-0000-0000-0000-000000000013', 4, 'Ensamble'),
  ('00000000-0000-0000-0000-000000000013', 5, 'Curado'),
  ('00000000-0000-0000-0000-000000000013', 6, 'Neumática'),
  ('00000000-0000-0000-0000-000000000013', 7, 'Atornillado');

-- A couple of stations on the other lines, for variety.
insert into public.estaciones (linea_id, numero, nombre) values
  ('00000000-0000-0000-0000-000000000011', 1, 'Prensa'),
  ('00000000-0000-0000-0000-000000000011', 2, 'Soldadura'),
  ('00000000-0000-0000-0000-000000000012', 1, 'Cabina de pintura');

-- Users: same names/iniciales/colors/PINs as lib/mock-data.ts. Five on
-- Línea 3 (where the seeded alerts/KPIs live), one on Línea 1.
insert into public.usuarios (id, linea_id, nombre, iniciales, color) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000013', 'Ana Ríos', 'AR', '#2563eb'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000013', 'Beto Cruz', 'BC', '#7c3aed'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000013', 'Caro Díaz', 'CD', '#0891b2'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000013', 'Diego Mora', 'DM', '#c026d3'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000013', 'Eli Vega', 'EV', '#ea580c'),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000011', 'Fer Luna', 'FL', '#0d9488');

insert into public.usuarios_pin (usuario_id, pin_hash) values
  ('00000000-0000-0000-0000-000000000101', extensions.crypt('1234', extensions.gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000102', extensions.crypt('2468', extensions.gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000103', extensions.crypt('1357', extensions.gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000104', extensions.crypt('9753', extensions.gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000105', extensions.crypt('4321', extensions.gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000106', extensions.crypt('8642', extensions.gen_salt('bf')));

-- KPIs per line. Línea 3 values match lib/mock-data.ts INDICADORES exactly.
insert into public.indicadores (linea_id, clave, nombre, valor, unidad, estado, detalle, orden) values
  ('00000000-0000-0000-0000-000000000013', 'fpy', 'FPY', 88.4, '%', 'parar', 'Rendimiento a primera pasada', 1),
  ('00000000-0000-0000-0000-000000000013', 'dph', 'Defectos / hora', 5, 'defectos/h', 'atencion', 'Umbral de atención 4-6', 2),
  ('00000000-0000-0000-0000-000000000013', 'scrap', 'Scrap', 1.6, '%', 'ok', 'Dentro del objetivo (<= 2 %)', 3),
  ('00000000-0000-0000-0000-000000000011', 'fpy', 'FPY', 94.2, '%', 'ok', 'Rendimiento a primera pasada', 1),
  ('00000000-0000-0000-0000-000000000011', 'dph', 'Defectos / hora', 2, 'defectos/h', 'ok', 'Umbral de atención 4-6', 2),
  ('00000000-0000-0000-0000-000000000011', 'scrap', 'Scrap', 0.9, '%', 'ok', 'Dentro del objetivo (<= 2 %)', 3),
  ('00000000-0000-0000-0000-000000000012', 'fpy', 'FPY', 90.1, '%', 'atencion', 'Rendimiento a primera pasada', 1),
  ('00000000-0000-0000-0000-000000000012', 'dph', 'Defectos / hora', 4, 'defectos/h', 'atencion', 'Umbral de atención 4-6', 2),
  ('00000000-0000-0000-0000-000000000012', 'scrap', 'Scrap', 1.8, '%', 'atencion', 'Dentro del objetivo (<= 2 %)', 3);

-- Initial active alerts on Línea 3, matching lib/mock-data.ts
-- ALERTAS_INICIALES (id/severidad/titulo/estación/relative age), with
-- plausible valor/limite/unidad added for the alert detail screen.
insert into public.alertas (linea_id, estacion_id, severidad, titulo, valor, limite, unidad, creada_en) values
  (
    '00000000-0000-0000-0000-000000000013',
    (select id from public.estaciones where linea_id = '00000000-0000-0000-0000-000000000013' and numero = 4),
    'parar', 'FPY por debajo del 90 %', 88.4, 90, '%', now() - interval '2 minutes'
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    (select id from public.estaciones where linea_id = '00000000-0000-0000-0000-000000000013' and numero = 7),
    'parar', 'Torque fuera de rango', 12.5, 10, 'Nm', now() - interval '6 minutes'
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    (select id from public.estaciones where linea_id = '00000000-0000-0000-0000-000000000013' and numero = 2),
    'atencion', 'Defectos por hora en aumento', 5, 4, 'defectos/h', now() - interval '11 minutes'
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    (select id from public.estaciones where linea_id = '00000000-0000-0000-0000-000000000013' and numero = 5),
    'atencion', 'Temperatura de horno alta', 185, 180, '°C', now() - interval '18 minutes'
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    (select id from public.estaciones where linea_id = '00000000-0000-0000-0000-000000000013' and numero = 3),
    'atencion', 'Retrabajo sobre lo esperado', 7.2, 5, '%', now() - interval '24 minutes'
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    (select id from public.estaciones where linea_id = '00000000-0000-0000-0000-000000000013' and numero = 1),
    'ok', 'Calibración completada', null, null, null, now() - interval '40 minutes'
  ),
  -- "Línea completa" in the mock (no single station): estacion_id null.
  (
    '00000000-0000-0000-0000-000000000013',
    null,
    'ok', 'Turno anterior sin scrap', null, null, null, now() - interval '55 minutes'
  );

-- Simulator catalog (>= 8 templates), covering the stations above. Weights
-- (peso) are relative, used by demo_generar_alertas' weighted pick.
insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso) values
  ('parar', 'Paro de línea por fuga de aire', 6, '%', 60, 100, 90, 1),
  ('atencion', 'Nivel de adhesivo bajo', 5, '%', 10, 30, 25, 3),
  ('parar', 'Torque fuera de rango', 7, 'Nm', 8, 15, 10, 2),
  ('atencion', 'Defectos por hora en aumento', 2, 'defectos/h', 4, 9, 4, 4),
  ('atencion', 'Temperatura de horno alta', 5, '°C', 170, 210, 180, 3),
  ('atencion', 'Retrabajo sobre lo esperado', 3, '%', 5, 12, 5, 3),
  ('parar', 'Sensor de presión sin respuesta', 6, 'kPa', 0, 50, 80, 1),
  ('atencion', 'Vibración anómala en banda', 4, 'mm/s', 3, 9, 4.5, 2),
  ('ok', 'Nivel de refrigerante en rango', 1, '%', 40, 90, 30, 5);

commit;
