-- G8: "Participante actual" counter -- persisted on private.demo_configuracion,
-- bumped only by demo_nuevo_participante() (never by demo_reiniciar() or
-- demo_aplicar_escenario(), which are facilitator/demo-state resets, not a
-- new-participant action).
begin;
select plan(10);

select is(public.demo_participante_actual(), 1, 'defaults to 1');

select ok(
  not has_function_privilege('anon', 'public.demo_participante_actual()', 'execute'),
  'anon cannot execute demo_participante_actual'
);
select ok(
  not has_function_privilege('authenticated', 'public.demo_participante_actual()', 'execute'),
  'authenticated cannot execute demo_participante_actual'
);
select ok(
  not has_function_privilege('anon', 'public.demo_nuevo_participante()', 'execute'),
  'anon cannot execute demo_nuevo_participante'
);
select ok(
  not has_function_privilege('authenticated', 'public.demo_nuevo_participante()', 'execute'),
  'authenticated cannot execute demo_nuevo_participante'
);

select is(public.demo_nuevo_participante(), 2, 'demo_nuevo_participante() returns the bumped value');
select is(public.demo_participante_actual(), 2, 'demo_participante_actual() reflects the bump');

-- Facilitator/demo-state resets must never bump the participant counter.
select public.demo_reiniciar();
select is(public.demo_participante_actual(), 2, 'demo_reiniciar() does not bump the participant counter');

select public.demo_aplicar_escenario('todo-ok');
select is(public.demo_participante_actual(), 2, 'demo_aplicar_escenario() does not bump the participant counter');

-- demo_nuevo_participante() also resets the demo (same effect as
-- demo_reiniciar()) -- verified here via one of reiniciar's own observable
-- side effects (alertas cleared back to the Línea 3 seed count).
insert into public.alertas (linea_id, estacion_id, severidad, titulo, valor, limite, unidad, estado)
select l.id, null, 'atencion', 'Alerta de prueba G8', 1, 1, '%', 'nueva'
from public.lineas l where l.nombre = 'Línea 3 · Motores';

select public.demo_nuevo_participante();
select is(
  (select count(*)::int from public.alertas a join public.lineas l on l.id = a.linea_id
     where l.nombre = 'Línea 3 · Motores' and a.titulo = 'Alerta de prueba G8'),
  0,
  'demo_nuevo_participante() also resets the demo state (test alert cleared)'
);

select * from finish();
rollback;
