-- H1 + H2 (Phase B'' hardening): guard public.resolver_alerta against
-- concurrent resolution and NULL input. Replaces the function in full
-- (`create or replace`, same signature) instead of editing migration 2.

create or replace function public.resolver_alerta(
  p_sesion_id uuid,
  p_alerta_id uuid,
  p_resolucion public.estado_alerta
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid;
  v_linea_id uuid;
  v_alerta_linea_id uuid;
  v_estado public.estado_alerta;
begin
  select usuario_id, linea_id into v_usuario_id, v_linea_id
  from private.validar_sesion(p_sesion_id);

  -- H2: a bare `p_resolucion not in (...)` against a NULL value evaluates to
  -- NULL (unknown), not false, so `if` silently skips the guard. Reject NULL
  -- explicitly, with the same errcode as any other invalid resolution.
  if p_resolucion is null or p_resolucion not in ('atendida', 'no_aplica') then
    raise exception 'Invalid resolution.' using errcode = '22023';
  end if;

  -- H1: lock the row before deciding anything from its estado, so a
  -- concurrent resolver_alerta call for the same alerta_id blocks here
  -- instead of both reading 'nueva' and both trying to resolve it.
  select a.linea_id, a.estado into v_alerta_linea_id, v_estado
  from public.alertas a
  where a.id = p_alerta_id
  for update;

  -- H2: null-safe line-ownership check (v_linea_id can never actually be
  -- null here, since private.validar_sesion always raises first when it
  -- would be, but `is distinct from` is the correct comparison regardless).
  if not found or v_alerta_linea_id is distinct from v_linea_id then
    raise exception 'Alert not found.' using errcode = 'P0002';
  end if;

  if v_estado <> 'nueva' then
    -- Already resolved (either resolution): idempotent no-op. Verified by
    -- supabase/tests/04_resolver_alerta.test.sql's "resolving an
    -- already-resolved alert again does not raise" case, which is exactly
    -- the deterministic form of the race this migration closes: a second
    -- call arriving after the state change is a no-op, not an error.
    return;
  end if;

  -- H1: belt and suspenders. Even without the row lock above, this WHERE
  -- clause alone makes the update itself race-safe: a second concurrent
  -- caller's UPDATE matches zero rows once the first one has committed.
  update public.alertas
  set estado = p_resolucion,
      resuelta_por = v_usuario_id,
      resuelta_en = now()
  where id = p_alerta_id
    and estado = 'nueva';
end;
$$;
