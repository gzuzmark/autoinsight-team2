-- G8: "Participante actual" counter (back office "Estado de la demo" card,
-- "Nuevo participante" button). Persisted on the same
-- `private.demo_configuracion` singleton `demo_estado_activo()`/
-- `demo_enviar_reporte_turno()` already use -- a facilitator-visible
-- counter, not "reset" demo state, so `private.reiniciar_estado_demo()` is
-- deliberately NOT redefined here (same rationale as migration
-- 20260928000024's `enviar_reporte_turno` column: a plain "Reiniciar demo"
-- must not bump the participant number, only "Nuevo participante" does).
--
-- G8 identifies each guerrilla-testing participant to PostHog as "P<n>"
-- (lib/analytics/events.ts) -- this counter is the single source of that
-- number for both the floor (via `tablero()`'s new `participante` field)
-- and the back office (`demo_estado_lineas`'s sibling read below).

alter table private.demo_configuracion
  add column participante_actual int not null default 1
  constraint demo_configuracion_participante_check check (participante_actual >= 1);

comment on column private.demo_configuracion.participante_actual is
  'G8: current guerrilla-testing participant number ("P<n>"). Bumped only by '
  'demo_nuevo_participante() -- reiniciar_estado_demo()/aplicar_escenario() must never touch it.';

create function public.demo_participante_actual()
returns int
language sql
security definer
set search_path = ''
stable
as $$
  select participante_actual from private.demo_configuracion where id;
$$;

comment on function public.demo_participante_actual() is
  'Número del participante actual (G8, back office "Estado de la demo" / floor identify).';

revoke execute on function public.demo_participante_actual() from public, anon, authenticated;
grant execute on function public.demo_participante_actual() to service_role, postgres;

-- G8: "Nuevo participante" -- resets the demo (identical effect to
-- demo_reiniciar(), including the active-scenario/session/lockout clearing
-- private.reiniciar_estado_demo() already does) and THEN increments the
-- participant counter, returning the new value so the caller never needs a
-- separate read.
create function public.demo_nuevo_participante()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nuevo int;
begin
  perform private.reiniciar_estado_demo();
  update private.demo_configuracion
  set participante_actual = participante_actual + 1
  where id
  returning participante_actual into v_nuevo;
  return v_nuevo;
end;
$$;

comment on function public.demo_nuevo_participante() is
  'Reinicia la demo (igual que demo_reiniciar()) y avanza el contador de participante (G8).';

revoke execute on function public.demo_nuevo_participante() from public, anon, authenticated;
grant execute on function public.demo_nuevo_participante() to service_role, postgres;
