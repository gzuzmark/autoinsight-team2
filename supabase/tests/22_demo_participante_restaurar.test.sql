-- K-2: public.demo_restaurar_participante_actual is the test/ops-only
-- restore hook the integration test suite uses to leave
-- private.demo_configuracion.participante_actual as it found it.
begin;
select plan(6);

select is(public.demo_participante_actual(), 1, 'defaults to 1');

select public.demo_nuevo_participante();
select is(public.demo_participante_actual(), 2, 'sanity: bumped to 2');

select public.demo_restaurar_participante_actual(1);
select is(public.demo_participante_actual(), 1, 'restaurar sets it back to the given value');

select public.demo_restaurar_participante_actual(7);
select is(public.demo_participante_actual(), 7, 'restaurar accepts any value >= 1');

select ok(
  not has_function_privilege('anon', 'public.demo_restaurar_participante_actual(int)', 'execute'),
  'anon cannot execute demo_restaurar_participante_actual'
);
select ok(
  not has_function_privilege('authenticated', 'public.demo_restaurar_participante_actual(int)', 'execute'),
  'authenticated cannot execute demo_restaurar_participante_actual'
);

select * from finish();
rollback;
