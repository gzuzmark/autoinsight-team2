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

-- E3/D28: one demo_panel control-panel row per line. The
-- lineas_crear_panel_demo_trigger (migration 20260926000018) already inserts
-- these automatically on every `insert into lineas`, so this statement is
-- redundant with the trigger on a fresh database -- kept explicit anyway so
-- the seed file stays self-describing and a future change to the trigger
-- cannot silently leave a fresh database without its demo_panel rows.
insert into public.demo_panel (linea_id, linea) values
  ('00000000-0000-0000-0000-000000000011', 'Línea 1 · Chasis'),
  ('00000000-0000-0000-0000-000000000012', 'Línea 2 · Pintura'),
  ('00000000-0000-0000-0000-000000000013', 'Línea 3 · Motores')
on conflict (linea_id) do nothing;

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

-- KPIs per line (D24). `estado` is a GENERATED column derived from
-- valor/mayor_es_mejor/umbral_atencion/umbral_parar (see migration
-- 20260926000015), so it is NOT listed here. Thresholds: FPY is
-- higher-is-better (atencion < 92, parar < 90); Defectos / hora and Scrap
-- are lower-is-better (atencion/parar above their thresholds). Línea 3
-- values/thresholds match lib/mock-data.ts INDICADORES exactly and derive
-- the same states as before this migration (FPY parar, Defectos atencion,
-- Scrap ok). Líneas 1/2 use plausible values under the same thresholds.
insert into public.indicadores
  (linea_id, clave, nombre, valor, unidad, mayor_es_mejor, umbral_atencion, umbral_parar, detalle, orden)
values
  ('00000000-0000-0000-0000-000000000013', 'fpy', 'FPY', 88.4, '%', true, 92, 90, 'Rendimiento a primera pasada', 1),
  ('00000000-0000-0000-0000-000000000013', 'dph', 'Defectos / hora', 5, 'defectos/h', false, 4, 6, 'Umbral de atención 4-6', 2),
  ('00000000-0000-0000-0000-000000000013', 'scrap', 'Scrap', 1.6, '%', false, 2, 3, 'Dentro del objetivo (<= 2 %)', 3),
  ('00000000-0000-0000-0000-000000000011', 'fpy', 'FPY', 94.2, '%', true, 92, 90, 'Rendimiento a primera pasada', 1),
  ('00000000-0000-0000-0000-000000000011', 'dph', 'Defectos / hora', 2, 'defectos/h', false, 4, 6, 'Umbral de atención 4-6', 2),
  ('00000000-0000-0000-0000-000000000011', 'scrap', 'Scrap', 0.9, '%', false, 2, 3, 'Dentro del objetivo (<= 2 %)', 3),
  ('00000000-0000-0000-0000-000000000012', 'fpy', 'FPY', 90.1, '%', true, 92, 90, 'Rendimiento a primera pasada', 1),
  ('00000000-0000-0000-0000-000000000012', 'dph', 'Defectos / hora', 4.5, 'defectos/h', false, 4, 6, 'Umbral de atención 4-6', 2),
  ('00000000-0000-0000-0000-000000000012', 'scrap', 'Scrap', 2.4, '%', false, 2, 3, 'Dentro del objetivo (<= 2 %)', 3);

-- Initial active alerts on Línea 3, matching lib/mock-data.ts
-- ALERTAS_INICIALES (id/severidad/titulo/estación/relative age), with
-- plausible valor/limite/unidad added for the alert detail screen.
--
-- G2: this insert lives in `private.sembrar_alertas_linea3` (migration
-- 20260928000021_demo_reiniciar_y_estado.sql) instead of a literal insert
-- here, so `demo_reiniciar()` reproduces exactly this same data with no risk
-- of drifting from it.
select private.sembrar_alertas_linea3('00000000-0000-0000-0000-000000000013');

-- Simulator catalog (>= 8 templates), covering the stations above. Weights
-- (peso) are relative, used by demo_generar_alertas' weighted pick.
-- `indicador_clave` (D25) links a template to a KPI. As of Phase F (D31), 10
-- of the 11 templates are linked (only "Nivel de refrigerante en rango",
-- severidad ok, stays unlinked); each linked template also carries its own
-- `lectura_min`/`lectura_max` (D31): the range demo_generar_alertas draws
-- the RECORDED KPI READING from, in the KPI's own unit -- separate from
-- `valor_min`/`valor_max`, the range for the alert's own displayed valor (in
-- the alert's own unit, e.g. Nm for Torque). Both ranges land inside the
-- band matching the template's own severidad (see the thresholds on the
-- indicadores insert above) so a generated reading never disagrees with the
-- alert it came from.
insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso, indicador_clave, lectura_min, lectura_max) values
  ('parar', 'Paro de línea por fuga de aire', 6, '%', 60, 100, 90, 1, 'fpy', 84, 89.5),
  ('atencion', 'Nivel de adhesivo bajo', 5, '%', 10, 30, 25, 3, 'scrap', 2.1, 2.9),
  ('parar', 'Torque fuera de rango', 7, 'Nm', 8, 15, 10, 2, 'dph', 6.2, 9),
  ('atencion', 'Defectos por hora en aumento', 2, 'defectos/h', 4.5, 6, 4, 4, 'dph', 4.5, 6),
  ('atencion', 'Temperatura de horno alta', 5, '°C', 170, 210, 180, 3, 'scrap', 2.1, 2.9),
  ('atencion', 'Retrabajo sobre lo esperado', 3, '%', 5, 12, 5, 3, 'fpy', 90.2, 91.8),
  ('parar', 'Sensor de presión sin respuesta', 6, 'kPa', 0, 50, 80, 1, 'dph', 6.2, 9),
  ('atencion', 'Vibración anómala en banda', 4, 'mm/s', 3, 9, 4.5, 2, 'dph', 4.2, 5.9),
  ('ok', 'Nivel de refrigerante en rango', 1, '%', 40, 90, 30, 5, null, null, null),
  ('parar', 'FPY por debajo del objetivo', 4, '%', 82, 89.5, 90, 2, 'fpy', 82, 89.5),
  ('atencion', 'Scrap por encima del objetivo', 3, '%', 2.1, 2.9, 2, 2, 'scrap', 2.1, 2.9);

commit;
