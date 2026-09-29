-- K-2: test/ops-only restore for the participant counter added in
-- 20260929000029. `demo_nuevo_participante()` can only ever increment; the
-- integration test suite (lib/domain/supabase-floor-repository.integration.test.ts)
-- calls it against the shared LOCAL stack, permanently advancing the
-- counter unless something can set it back. Without this, running the
-- integration suite and then `supabase test db` on the same database
-- (no `supabase db reset --local` in between) makes
-- supabase/tests/21_demo_participante.test.sql's "defaults to 1" assertion
-- fail, because pgTAP's `begin; ... rollback;` wrapper only protects state
-- IT changes, not state a previous, already-committed process changed.
--
-- Same trust tier as demo_nuevo_participante()/demo_reiniciar(): SECURITY
-- DEFINER, service_role/postgres only (never callable with the anon/
-- authenticated/publishable key an app or a compromised client could hold).
-- Never called from application code (no route wires it) -- the
-- integration test's own `afterEach` cleanup is its only caller.
create function public.demo_restaurar_participante_actual(p_valor int)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.demo_configuracion set participante_actual = p_valor where id;
$$;

comment on function public.demo_restaurar_participante_actual(int) is
  'Test/ops-only: restores private.demo_configuracion.participante_actual to a '
  'specific value (K-2). Never called from application code.';

revoke execute on function public.demo_restaurar_participante_actual(int) from public, anon, authenticated;
grant execute on function public.demo_restaurar_participante_actual(int) to service_role, postgres;
