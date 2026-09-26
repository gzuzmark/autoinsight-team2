-- H5 (Phase B'' hardening): login lockout DoS mitigation and admin unlock.
--
-- Before this migration, once a lock expired (bloqueado_hasta in the past),
-- the next wrong PIN kept incrementing the stale counter (already at
-- private.max_intentos_fallidos()) and immediately relocked the user -- an
-- indefinite lockout anyone could trigger with 5 wrong PINs, since the
-- counter never resets on its own. Per-client/IP request throttling (rate
-- limiting the login route itself, independent of this per-account
-- counter) belongs to the Next.js route handlers (T8), not the database.

create or replace function public.iniciar_sesion(p_usuario_id uuid, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pin_hash text;
  v_activo boolean;
  v_bloqueado_hasta timestamptz;
  v_fallidos int;
  v_sesion_id uuid;
begin
  select p.pin_hash, u.activo
    into v_pin_hash, v_activo
  from public.usuarios u
  left join public.usuarios_pin p on p.usuario_id = u.id
  where u.id = p_usuario_id;

  -- H8: no session is ever created for an unknown user, a user with no PIN
  -- row at all, or an inactive user. All three behave exactly like a
  -- locked-out/wrong-PIN user (return null), and none of them touch
  -- intentos_login (there is nothing meaningful to key a lockout counter on
  -- for a user that cannot log in for reasons unrelated to PIN attempts).
  if not found or v_pin_hash is null or not v_activo then
    return null;
  end if;

  -- Serialize attempts per user: ensure the counter row exists, then lock it
  -- so concurrent wrong-PIN calls cannot overwrite each other's increment.
  insert into public.intentos_login (usuario_id, fallidos, bloqueado_hasta)
  values (p_usuario_id, 0, null)
  on conflict (usuario_id) do nothing;

  select il.fallidos, il.bloqueado_hasta
    into v_fallidos, v_bloqueado_hasta
  from public.intentos_login il
  where il.usuario_id = p_usuario_id
  for update;

  if v_bloqueado_hasta is not null and v_bloqueado_hasta > now() then
    return null;
  end if;

  -- H5: a lock that has already expired must not keep counting from where
  -- it left off. Once bloqueado_hasta is in the past, the next failure
  -- starts a fresh count: 5 new consecutive failures are required to
  -- relock, instead of a single failure re-arming an already-expired lock.
  if v_bloqueado_hasta is not null and v_bloqueado_hasta <= now() then
    v_fallidos := 0;
  end if;

  -- crypt() is STRICT: a null PIN yields null, so compare null-safely and
  -- treat a null PIN as a failed attempt.
  if p_pin is null or v_pin_hash is distinct from extensions.crypt(p_pin, v_pin_hash) then
    v_fallidos := v_fallidos + 1;
    update public.intentos_login
    set fallidos = v_fallidos,
        bloqueado_hasta = case
          when v_fallidos >= private.max_intentos_fallidos() then now() + private.duracion_bloqueo()
          else null
        end
    where usuario_id = p_usuario_id;
    return null;
  end if;

  -- Success: reset the counter and open a session.
  update public.intentos_login
  set fallidos = 0,
      bloqueado_hasta = null
  where usuario_id = p_usuario_id;

  insert into public.sesiones (usuario_id)
  values (p_usuario_id)
  returning id into v_sesion_id;

  return v_sesion_id;
end;
$$;

-- H5: admin/demo unlock. Clears a lockout unconditionally, for an operator
-- who got locked out and needs back in before private.duracion_bloqueo()
-- elapses, without waiting. service_role only, same as every other RPC;
-- there is no anon/authenticated path to this function.

create function public.desbloquear_usuario(p_usuario_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.intentos_login
  set fallidos = 0,
      bloqueado_hasta = null
  where usuario_id = p_usuario_id;
$$;

revoke execute on function public.desbloquear_usuario(uuid) from public;
grant execute on function public.desbloquear_usuario(uuid) to service_role;
