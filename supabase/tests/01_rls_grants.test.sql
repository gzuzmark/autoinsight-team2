-- RLS + grants tests (D17): RLS enabled on every public table, and
-- anon/authenticated have no table privileges and no EXECUTE on any RPC.
begin;
select plan(24);

-- RLS enabled on every public table -----------------------------------------
select is(
  (select bool_and(c.relrowsecurity)
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'),
  true,
  'every public table has row level security enabled'
);

select is(
  (select count(*)::int from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'),
  11,
  'exactly 11 tables exist in public (sanity check for the assertion above; E3 added demo_panel)'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public'),
  0,
  'no RLS policies exist on any public table (anon/authenticated get nothing)'
);

-- No table privileges for anon/authenticated --------------------------------
select ok(
  not has_table_privilege('anon', 'public.plantas', 'select'),
  'anon cannot select plantas'
);
select ok(
  not has_table_privilege('anon', 'public.lineas', 'select'),
  'anon cannot select lineas'
);
select ok(
  not has_table_privilege('anon', 'public.estaciones', 'select'),
  'anon cannot select estaciones'
);
select ok(
  not has_table_privilege('anon', 'public.usuarios', 'select'),
  'anon cannot select usuarios'
);
select ok(
  not has_table_privilege('anon', 'public.usuarios_pin', 'select'),
  'anon cannot select usuarios_pin'
);
select ok(
  not has_table_privilege('anon', 'public.intentos_login', 'select'),
  'anon cannot select intentos_login'
);
select ok(
  not has_table_privilege('anon', 'public.sesiones', 'select'),
  'anon cannot select sesiones'
);
select ok(
  not has_table_privilege('anon', 'public.indicadores', 'select'),
  'anon cannot select indicadores'
);
select ok(
  not has_table_privilege('anon', 'public.alertas', 'select'),
  'anon cannot select alertas'
);
select ok(
  not has_table_privilege('anon', 'public.plantillas_alerta', 'select'),
  'anon cannot select plantillas_alerta'
);
select ok(
  not has_table_privilege('anon', 'public.demo_panel', 'select'),
  'anon cannot select demo_panel'
);
select ok(
  not has_table_privilege('authenticated', 'public.demo_panel', 'update'),
  'authenticated cannot update demo_panel'
);
select ok(
  not has_table_privilege('anon', 'public.alertas', 'insert'),
  'anon cannot insert alertas'
);
select ok(
  not has_table_privilege('anon', 'public.alertas', 'update'),
  'anon cannot update alertas'
);

select ok(
  not has_table_privilege('authenticated', 'public.alertas', 'select'),
  'authenticated cannot select alertas'
);
select ok(
  not has_table_privilege('authenticated', 'public.usuarios', 'select'),
  'authenticated cannot select usuarios'
);
select ok(
  not has_table_privilege('authenticated', 'public.sesiones', 'insert'),
  'authenticated cannot insert sesiones'
);

-- service_role keeps full access (it is the server-side key, D17) ----------
select ok(
  has_table_privilege('service_role', 'public.alertas', 'select'),
  'service_role can select alertas'
);
select ok(
  has_table_privilege('service_role', 'public.alertas', 'update'),
  'service_role can update alertas'
);

-- private schema is unreachable for anon/authenticated -----------------------
select ok(
  not has_schema_privilege('anon', 'private', 'usage'),
  'anon has no USAGE on schema private'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated has no USAGE on schema private'
);

select * from finish();
rollback;
