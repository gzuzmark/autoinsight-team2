-- demo_generar_alertas / demo_autoresolver tests: weighted inserts, dedupe,
-- auto-resolve by age.
begin;
select plan(14);

-- Isolate from supabase/seed.sql: clear any pre-existing active alerts so
-- demo_autoresolver's count below reflects only this test's own data, and
-- clear the seeded template catalog so demo_generar_alertas' weighted pick
-- below has exactly one candidate (this test's own template) instead of
-- competing with the 9 seed templates.
update public.alertas set estado = 'no_aplica', resuelta_en = now() where estado = 'nueva';
delete from public.plantillas_alerta;

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Línea Test', 'Turno mañana');
insert into public.estaciones (linea_id, numero, nombre)
  values ('22222222-2222-2222-2222-222222222222', 6, 'Neumática');

insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso)
  values ('parar', 'Paro de línea por fuga de aire', 6, '%', 0, 100, 90, 1);

-- Generates exactly one alert on the target line, using the template's data
select is(
  (select count(*)::int from public.demo_generar_alertas('22222222-2222-2222-2222-222222222222'::uuid, 1)),
  1,
  'demo_generar_alertas inserts one row for cantidad = 1'
);
select is(
  (select count(*)::int from public.alertas
     where linea_id = '22222222-2222-2222-2222-222222222222' and titulo = 'Paro de línea por fuga de aire'),
  1,
  'the generated alert is persisted'
);
select is(
  (select severidad::text from public.alertas where titulo = 'Paro de línea por fuga de aire'),
  'parar',
  'the generated alert copies the template severidad'
);
select is(
  (select estacion_id from public.alertas where titulo = 'Paro de línea por fuga de aire'),
  (select id from public.estaciones where linea_id = '22222222-2222-2222-2222-222222222222' and numero = 6),
  'the generated alert links to the matching estacion by numero'
);
select ok(
  (select valor between 0 and 100 from public.alertas where titulo = 'Paro de línea por fuga de aire'),
  'the generated alert valor falls within the template range'
);

-- J5(a): dedupe conflict path -- a second call, with the template's titulo
-- already active on the line, returns zero rows (function-level, not just
-- the persisted count) and leaves the active count unchanged -------------
select is(
  (select count(*)::int from public.demo_generar_alertas('22222222-2222-2222-2222-222222222222'::uuid, 1)),
  0,
  'demo_generar_alertas returns zero rows when the template''s titulo is already active on the line'
);
select is(
  (select count(*)::int from public.alertas
     where linea_id = '22222222-2222-2222-2222-222222222222' and titulo = 'Paro de línea por fuga de aire'),
  1,
  'demo_generar_alertas does not duplicate an already-active titulo on the same line'
);

-- demo_autoresolver marks old active alerts no_aplica by the system --------
insert into public.alertas (id, linea_id, severidad, titulo, creada_en)
  values ('a0000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'ok', 'Vieja', now() - interval '1 hour');
select is(
  public.demo_autoresolver('30 minutes'::interval),
  1,
  'demo_autoresolver resolves exactly the alerts older than the given age'
);
select is(
  (select resuelta_por from public.alertas where id = 'a0000000-0000-0000-0000-000000000009'),
  null,
  'a system auto-resolve leaves resuelta_por null'
);

-- J3: demo_autoresolver's default staleness age resolves inside the
-- function via private.antiguedad_autoresolver_defecto(), and works with NO
-- argument at all as service_role -- the only role that ever calls this RPC
-- (from the app, or from a pg_cron job scheduled as postgres, see
-- supabase/snippets/cron_demo.sql).
insert into public.alertas (id, linea_id, severidad, titulo, creada_en)
  values ('a0000000-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'ok', 'Vieja sin argumento', now() - interval '1 hour');
set local role service_role;
select lives_ok(
  $$ select public.demo_autoresolver() $$,
  'demo_autoresolver() with no argument succeeds as service_role'
);
reset role;
select is(
  (select estado::text from public.alertas where id = 'a0000000-0000-0000-0000-00000000000a'),
  'no_aplica',
  'demo_autoresolver() with no argument still resolves alerts older than the default 30 minutes'
);

-- The private getter behind that default returns exactly 30 minutes.
select is(
  private.antiguedad_autoresolver_defecto(),
  interval '30 minutes',
  'private.antiguedad_autoresolver_defecto returns 30 minutes'
);

-- Already-active templates are excluded before the weighted pick: the
-- heavy template is active on this line, so the light one must be chosen.
update public.plantillas_alerta set peso = 1000 where titulo = 'Paro de línea por fuga de aire';
insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso)
  values ('atencion', 'Nivel de adhesivo bajo', 6, '%', 0, 100, 20, 1);
select is(
  (select count(*)::int from public.demo_generar_alertas('22222222-2222-2222-2222-222222222222'::uuid, 1)),
  1,
  'demo_generar_alertas skips templates already active on the line instead of generating nothing'
);
select is(
  (select count(*)::int from public.alertas
     where linea_id = '22222222-2222-2222-2222-222222222222' and titulo = 'Nivel de adhesivo bajo' and estado = 'nueva'),
  1,
  'the remaining available template is the one generated'
);

select * from finish();
rollback;
