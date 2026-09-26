-- H8 (Phase B'' hardening, readability): demo_autoresolver's default
-- staleness age moves to a named private.* constant, alongside the other
-- constants in migration 2, instead of repeating the '30 minutes' literal
-- as the parameter default. The function's signature is otherwise
-- unchanged, so `create or replace` applies cleanly.
--
-- Correction to migration 2's header comment ("every function is SECURITY
-- DEFINER"): that is not accurate for the private.* constant getters
-- (max_intentos_fallidos, duracion_bloqueo, duracion_sesion,
-- umbral_indicador_desactualizado, and this one) -- those are plain
-- LANGUAGE SQL functions with no SECURITY DEFINER, because they read no
-- table and need no privilege escalation. Only the RPCs that touch tables
-- (private.validar_sesion and every public.* function) are SECURITY
-- DEFINER. Migration 2's file is a reviewed slice and is not edited; this
-- comment documents the correction instead.

create function private.antiguedad_autoresolver_defecto()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '30 minutes' $$;

revoke execute on function private.antiguedad_autoresolver_defecto() from public;
grant execute on function private.antiguedad_autoresolver_defecto() to postgres, service_role;

create or replace function public.demo_autoresolver(
  p_antiguedad interval default private.antiguedad_autoresolver_defecto()
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.alertas
  set estado = 'no_aplica',
      resuelta_en = now()
  where estado = 'nueva'
    and creada_en < now() - p_antiguedad;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
