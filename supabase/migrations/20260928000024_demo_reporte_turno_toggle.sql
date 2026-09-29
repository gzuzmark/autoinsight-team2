-- G6: "Enviar reporte al simular turno" toggle (back office "Comunicaciones"
-- card, default ON). Persisted on the same `private.demo_configuracion`
-- singleton `demo_estado_activo()`/`aplicar_escenario()` already use for the
-- active-scenario id (migration 20260928000022) -- NOT reset by
-- `demo_reiniciar()`/`demo_aplicar_escenario()`: it is a facilitator
-- preference, not demo state, so those functions must not touch it (the
-- explicit `where id`/column list below never assigns it).

alter table private.demo_configuracion
  add column enviar_reporte_turno boolean not null default true;

comment on column private.demo_configuracion.enviar_reporte_turno is
  'G6: whether POST /api/backoffice/turno should also send a shift-report email. '
  'A facilitator preference, not demo state -- reiniciar/aplicar_escenario must never reset it.';

create function public.demo_enviar_reporte_turno()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select enviar_reporte_turno from private.demo_configuracion where id;
$$;

comment on function public.demo_enviar_reporte_turno() is
  'Estado actual del interruptor "Enviar reporte al simular turno" (G6).';

revoke execute on function public.demo_enviar_reporte_turno() from public, anon, authenticated;
grant execute on function public.demo_enviar_reporte_turno() to service_role, postgres;

create function public.demo_set_enviar_reporte_turno(p_valor boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.demo_configuracion set enviar_reporte_turno = p_valor where id;
$$;

comment on function public.demo_set_enviar_reporte_turno(boolean) is
  'Cambia el interruptor "Enviar reporte al simular turno" (G6, back office "Comunicaciones").';

revoke execute on function public.demo_set_enviar_reporte_turno(boolean) from public, anon, authenticated;
grant execute on function public.demo_set_enviar_reporte_turno(boolean) to service_role, postgres;
