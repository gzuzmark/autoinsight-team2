-- G6: "Enviar reporte al simular turno" toggle (back office "Comunicaciones"
-- card). Persisted on the private.demo_configuracion singleton; NOT reset
-- by demo_reiniciar() or demo_aplicar_escenario() (facilitator preference,
-- not demo state).
begin;
select plan(9);

select is(public.demo_enviar_reporte_turno(), true, 'defaults to ON (true)');

select ok(
  not has_function_privilege('anon', 'public.demo_enviar_reporte_turno()', 'execute'),
  'anon cannot execute demo_enviar_reporte_turno'
);
select ok(
  not has_function_privilege('authenticated', 'public.demo_enviar_reporte_turno()', 'execute'),
  'authenticated cannot execute demo_enviar_reporte_turno'
);
select ok(
  not has_function_privilege('anon', 'public.demo_set_enviar_reporte_turno(boolean)', 'execute'),
  'anon cannot execute demo_set_enviar_reporte_turno'
);
select ok(
  not has_function_privilege('authenticated', 'public.demo_set_enviar_reporte_turno(boolean)', 'execute'),
  'authenticated cannot execute demo_set_enviar_reporte_turno'
);

select lives_ok(
  $$select public.demo_set_enviar_reporte_turno(false)$$,
  'demo_set_enviar_reporte_turno(false) runs without error'
);
select is(public.demo_enviar_reporte_turno(), false, 'reflects the new value (false)');

-- Facilitator preference, not demo state: reset/scenario must not reset it.
select public.demo_reiniciar();
select is(public.demo_enviar_reporte_turno(), false, 'demo_reiniciar() does not reset the toggle');

select public.demo_aplicar_escenario('todo-ok');
select is(public.demo_enviar_reporte_turno(), false, 'demo_aplicar_escenario() does not reset the toggle');

select public.demo_set_enviar_reporte_turno(true);

select * from finish();
rollback;
