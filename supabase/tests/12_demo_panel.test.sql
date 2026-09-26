-- E3/D28: "Simular turno" is triggered from Supabase only now -- either
-- `public.demo_simular_turno_linea(linea, cantidad)` from the SQL editor, or
-- flipping `public.demo_panel.simular_turno` to TRUE from the Table Editor.
-- Both must run the exact same free-room + generate rules the removed
-- in-app button always had (shared via private.simular_turno_en_linea).
begin;
select plan(15);

insert into public.plantas (id, nombre) values ('11111111-1111-1111-1111-111111111111', 'Planta Test');
insert into public.lineas (id, planta_id, nombre, turno) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Línea Test', 'Turno mañana'),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Línea Test 2', 'Turno mañana');
insert into public.estaciones (linea_id, numero, nombre)
  values ('22222222-2222-2222-2222-222222222222', 1, 'Ensamble');

-- Isolate from supabase/seed.sql's template catalog, matching the pattern
-- used in 05_demo.test.sql/07_demo_simular_turno.test.sql: exactly one
-- candidate template so the weighted pick is deterministic.
delete from public.plantillas_alerta;
insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso)
  values ('parar', 'Paro de línea por fuga de aire', 1, '%', 0, 100, 90, 1);

-- demo_simular_turno_linea by exact name --------------------------------------
select is(
  (select count(*)::int from public.demo_simular_turno_linea('Línea Test', 1)),
  1,
  'demo_simular_turno_linea generates on the named line'
);
select is(
  (select count(*)::int from public.alertas
     where linea_id = '22222222-2222-2222-2222-222222222222' and estado = 'nueva'),
  1,
  'the generated alert lands on the resolved line, not any other'
);
select is(
  (select count(*)::int from public.alertas
     where linea_id = '22222222-2222-2222-2222-222222222223' and estado = 'nueva'),
  0,
  'no alert was generated on the other test line'
);

-- Unknown line name raises P0002 ----------------------------------------------
select throws_ok(
  $$ select public.demo_simular_turno_linea('Línea que no existe', 1) $$,
  'P0002',
  null,
  'demo_simular_turno_linea rejects an unknown line name with errcode P0002'
);

-- Shared logic parity: demo_simular_turno_linea frees room on a saturated
-- line exactly like demo_simular_turno (K5) -----------------------------------
insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso)
  values ('atencion', 'Nivel de adhesivo bajo', 1, '%', 0, 100, 20, 1);
select is(
  (select count(*)::int from public.demo_simular_turno_linea('Línea Test')),
  2,
  'default p_cantidad (2) frees room on a saturated line and generates 2, same as demo_simular_turno'
);
select is(
  (select count(*)::int from public.alertas
     where linea_id = '22222222-2222-2222-2222-222222222222'
       and estado = 'no_aplica' and resuelta_por is null and resuelta_en is not null),
  1,
  'the oldest active alert was closed as no_aplica by the system (parity with demo_simular_turno)'
);

-- anon/authenticated cannot execute the RPCs ----------------------------------
select ok(
  not has_function_privilege('anon', 'public.demo_simular_turno_linea(text, int)', 'execute'),
  'anon cannot execute demo_simular_turno_linea'
);
select ok(
  not has_function_privilege('authenticated', 'public.demo_simular_turno_linea(text, int)', 'execute'),
  'authenticated cannot execute demo_simular_turno_linea'
);

-- ---------------------------------------------------------------------------
-- demo_panel: setting simular_turno = true generates alerts, resets the
-- flag, and records ultima_simulacion / alertas_generadas.
-- ---------------------------------------------------------------------------

delete from public.plantillas_alerta;
insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso)
  values ('parar', 'Otro paro de línea', 1, '%', 0, 100, 90, 1);

update public.demo_panel set cantidad = 1 where linea_id = '22222222-2222-2222-2222-222222222223';
update public.demo_panel set simular_turno = true where linea_id = '22222222-2222-2222-2222-222222222223';

select is(
  (select count(*)::int from public.alertas
     where linea_id = '22222222-2222-2222-2222-222222222223' and estado = 'nueva'),
  1,
  'flipping demo_panel.simular_turno to TRUE generates an alert on that line'
);
select is(
  (select simular_turno from public.demo_panel where linea_id = '22222222-2222-2222-2222-222222222223'),
  false,
  'the trigger resets simular_turno back to FALSE'
);
select ok(
  (select ultima_simulacion from public.demo_panel where linea_id = '22222222-2222-2222-2222-222222222223') is not null,
  'ultima_simulacion is recorded'
);
select is(
  (select alertas_generadas from public.demo_panel where linea_id = '22222222-2222-2222-2222-222222222223'),
  1,
  'alertas_generadas records how many alerts this simulation actually inserted'
);

-- cantidad bounds --------------------------------------------------------------
select throws_ok(
  $$ update public.demo_panel set cantidad = 0 where linea_id = '22222222-2222-2222-2222-222222222222' $$,
  '23514',
  null,
  'cantidad below 1 violates the check constraint'
);
select throws_ok(
  $$ update public.demo_panel set cantidad = 6 where linea_id = '22222222-2222-2222-2222-222222222222' $$,
  '23514',
  null,
  'cantidad above 5 violates the check constraint'
);

-- anon/authenticated cannot touch demo_panel ----------------------------------
select ok(
  not has_table_privilege('anon', 'public.demo_panel', 'update'),
  'anon cannot update demo_panel'
);

select * from finish();
rollback;
