-- Seed parity tests (H7): asserts supabase/seed.sql matches lib/mock-data.ts
-- (planta, lineas, the 6 mock users incl. PIN, and Línea 3's KPI values and
-- states) so the two never silently drift apart. Runs against the database
-- `supabase db reset` just seeded; read-only (rollback at the end undoes
-- nothing since this file makes no writes).
begin;
select plan(23);

select is(
  (select count(*)::int from public.plantas),
  1,
  'exactly one planta is seeded'
);
select is(
  (select nombre from public.plantas limit 1),
  'Planta Norte',
  'the seeded planta is named Planta Norte, matching lib/mock-data.ts PLANTA_NOMBRE'
);
select is(
  (select count(*)::int from public.lineas),
  3,
  'exactly 3 lineas are seeded'
);
select is(
  (select count(*)::int from public.demo_panel),
  3,
  'E3: exactly one demo_panel row per seeded linea'
);
select is(
  (select count(*)::int from public.usuarios),
  6,
  'exactly the 6 mock users are seeded'
);

-- Each user's nombre/iniciales/color matches lib/mock-data.ts USUARIOS, and
-- the stored bcrypt hash verifies against that user's mock PIN.
select is(
  (select (nombre, iniciales, color)::text from public.usuarios where id = '00000000-0000-0000-0000-000000000101'),
  '("Ana Ríos",AR,#2563eb)',
  'Ana Ríos matches lib/mock-data.ts'
);
select ok(
  (select pin_hash = extensions.crypt('1234', pin_hash) from public.usuarios_pin where usuario_id = '00000000-0000-0000-0000-000000000101'),
  'Ana Ríos'' seeded PIN hash verifies against 1234'
);

select is(
  (select (nombre, iniciales, color)::text from public.usuarios where id = '00000000-0000-0000-0000-000000000102'),
  '("Beto Cruz",BC,#7c3aed)',
  'Beto Cruz matches lib/mock-data.ts'
);
select ok(
  (select pin_hash = extensions.crypt('2468', pin_hash) from public.usuarios_pin where usuario_id = '00000000-0000-0000-0000-000000000102'),
  'Beto Cruz'' seeded PIN hash verifies against 2468'
);

select is(
  (select (nombre, iniciales, color)::text from public.usuarios where id = '00000000-0000-0000-0000-000000000103'),
  '("Caro Díaz",CD,#0891b2)',
  'Caro Díaz matches lib/mock-data.ts'
);
select ok(
  (select pin_hash = extensions.crypt('1357', pin_hash) from public.usuarios_pin where usuario_id = '00000000-0000-0000-0000-000000000103'),
  'Caro Díaz'' seeded PIN hash verifies against 1357'
);

select is(
  (select (nombre, iniciales, color)::text from public.usuarios where id = '00000000-0000-0000-0000-000000000104'),
  '("Diego Mora",DM,#c026d3)',
  'Diego Mora matches lib/mock-data.ts'
);
select ok(
  (select pin_hash = extensions.crypt('9753', pin_hash) from public.usuarios_pin where usuario_id = '00000000-0000-0000-0000-000000000104'),
  'Diego Mora'' seeded PIN hash verifies against 9753'
);

select is(
  (select (nombre, iniciales, color)::text from public.usuarios where id = '00000000-0000-0000-0000-000000000105'),
  '("Eli Vega",EV,#ea580c)',
  'Eli Vega matches lib/mock-data.ts'
);
select ok(
  (select pin_hash = extensions.crypt('4321', pin_hash) from public.usuarios_pin where usuario_id = '00000000-0000-0000-0000-000000000105'),
  'Eli Vega'' seeded PIN hash verifies against 4321'
);

select is(
  (select (nombre, iniciales, color)::text from public.usuarios where id = '00000000-0000-0000-0000-000000000106'),
  '("Fer Luna",FL,#0d9488)',
  'Fer Luna matches lib/mock-data.ts'
);
select ok(
  (select pin_hash = extensions.crypt('8642', pin_hash) from public.usuarios_pin where usuario_id = '00000000-0000-0000-0000-000000000106'),
  'Fer Luna'' seeded PIN hash verifies against 8642'
);

-- Línea 3's KPIs match lib/mock-data.ts INDICADORES exactly. J5(e): compare
-- valor (numeric) and estado (the public.severidad enum -- indicadores'
-- estado column reuses it, distinct from alertas' severidad) as their own
-- typed values instead of a stringified row, so e.g. a numeric-vs-text or
-- enum-label mismatch fails on the actual value, not on incidental
-- formatting of the composite type's text representation.
select is(
  (select valor from public.indicadores
     where linea_id = '00000000-0000-0000-0000-000000000013' and clave = 'fpy'),
  88.4::numeric,
  'Línea 3 FPY valor is 88.4, matching lib/mock-data.ts'
);
select is(
  (select estado from public.indicadores
     where linea_id = '00000000-0000-0000-0000-000000000013' and clave = 'fpy'),
  'parar'::public.severidad,
  'Línea 3 FPY estado is parar, matching lib/mock-data.ts'
);
select is(
  (select valor from public.indicadores
     where linea_id = '00000000-0000-0000-0000-000000000013' and clave = 'dph'),
  5::numeric,
  'Línea 3 Defectos / hora valor is 5, matching lib/mock-data.ts'
);
select is(
  (select estado from public.indicadores
     where linea_id = '00000000-0000-0000-0000-000000000013' and clave = 'dph'),
  'atencion'::public.severidad,
  'Línea 3 Defectos / hora estado is atencion, matching lib/mock-data.ts'
);
select is(
  (select valor from public.indicadores
     where linea_id = '00000000-0000-0000-0000-000000000013' and clave = 'scrap'),
  1.6::numeric,
  'Línea 3 Scrap valor is 1.6, matching lib/mock-data.ts'
);
select is(
  (select estado from public.indicadores
     where linea_id = '00000000-0000-0000-0000-000000000013' and clave = 'scrap'),
  'ok'::public.severidad,
  'Línea 3 Scrap estado is ok, matching lib/mock-data.ts'
);

select * from finish();
rollback;
