-- J4 (Phase B''' follow-up): escalating login lockout. H5 (migration 7)
-- reset the failure counter once a lock expired, closing the "5 wrong PINs
-- locks forever" DoS, but left the lock duration fixed at
-- private.duracion_bloqueo() (5 minutes) no matter how many times the same
-- account gets locked -- an attacker (or a broken client retrying) can keep
-- an account locked ~5 minutes out of every 5-minute cycle indefinitely.
--
-- Each consecutive lock (a lock that follows another lock with no
-- successful login or admin unlock in between) now lasts longer:
-- private.duracion_bloqueo() * 2^(n-1), n = the running count of
-- consecutive locks (intentos_login.bloqueos), capped at
-- private.duracion_bloqueo_maxima() (60 minutes). A successful login or
-- public.desbloquear_usuario resets BOTH counters (fallidos and bloqueos).
-- An *expired* lock (H5's existing behavior) still resets only the failure
-- counter -- so a legitimate user who mistypes their PIN once right after a
-- lock expires is not instantly relocked -- but bloqueos survives that
-- expiry, so a *new* run of 5 failures escalates instead of relocking for
-- the same base 5 minutes forever. Per-client/IP request throttling (T8)
-- remains a separate, Next.js-side concern (see README).

alter table public.intentos_login
  add column bloqueos int not null default 0;

comment on column public.intentos_login.bloqueos is
  'Consecutive lock count; escalates the next lock''s duration via private.duracion_bloqueo_escalada(). Resets to 0 on a successful login or public.desbloquear_usuario, but NOT when a lock merely expires.';

-- Cap on the escalating lockout duration, regardless of how many
-- consecutive locks precede it.
create function private.duracion_bloqueo_maxima()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '60 minutes' $$;

-- The lockout duration for the n-th consecutive lock (n = bloqueos, already
-- incremented for the lock being applied): private.duracion_bloqueo(),
-- doubled once per prior consecutive lock, capped at
-- private.duracion_bloqueo_maxima().
create function private.duracion_bloqueo_escalada(p_bloqueos int)
returns interval
language sql
immutable
set search_path = ''
as $$
  select least(
    private.duracion_bloqueo() * power(2::float8, greatest(p_bloqueos - 1, 0)::float8),
    private.duracion_bloqueo_maxima()
  )
$$;

revoke execute on function private.duracion_bloqueo_maxima() from public;
revoke execute on function private.duracion_bloqueo_escalada(int) from public;
grant execute on function private.duracion_bloqueo_maxima() to postgres, service_role;
grant execute on function private.duracion_bloqueo_escalada(int) to postgres, service_role;

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
  v_bloqueos int;
  v_sesion_id uuid;
begin
  select p.pin_hash, u.activo
    into v_pin_hash, v_activo
  from public.usuarios u
  left join public.usuarios_pin p on p.usuario_id = u.id
  where u.id = p_usuario_id;

  -- No session is ever created for an unknown user, a user with no PIN row
  -- at all, or an inactive user. All three behave exactly like a
  -- locked-out/wrong-PIN user (return null), and none of them touch
  -- intentos_login (there is nothing meaningful to key a lockout counter on
  -- for a user that cannot log in for reasons unrelated to PIN attempts).
  if not found or v_pin_hash is null or not v_activo then
    return null;
  end if;

  -- Serialize attempts per user: ensure the counter row exists, then lock it
  -- so concurrent wrong-PIN calls cannot overwrite each other's increment.
  insert into public.intentos_login (usuario_id, fallidos, bloqueado_hasta, bloqueos)
  values (p_usuario_id, 0, null, 0)
  on conflict (usuario_id) do nothing;

  select il.fallidos, il.bloqueado_hasta, il.bloqueos
    into v_fallidos, v_bloqueado_hasta, v_bloqueos
  from public.intentos_login il
  where il.usuario_id = p_usuario_id
  for update;

  if v_bloqueado_hasta is not null and v_bloqueado_hasta > now() then
    return null;
  end if;

  -- H5: a lock that has already expired must not keep counting from where
  -- it left off -- the next failure starts a fresh count of 5 (this branch
  -- is only reached once bloqueado_hasta <= now(), the redundant re-check
  -- from migration 7 is dropped). J4: this resets only the failure
  -- counter, never bloqueos (the consecutive-lock count), so a new run of
  -- failures still escalates instead of relocking at the base duration
  -- forever.
  if v_bloqueado_hasta is not null then
    v_fallidos := 0;
  end if;

  -- crypt() is STRICT: a null PIN yields null, so compare null-safely and
  -- treat a null PIN as a failed attempt.
  if p_pin is null or v_pin_hash is distinct from extensions.crypt(p_pin, v_pin_hash) then
    v_fallidos := v_fallidos + 1;
    if v_fallidos >= private.max_intentos_fallidos() then
      v_bloqueos := v_bloqueos + 1;
      update public.intentos_login
      set fallidos = v_fallidos,
          bloqueos = v_bloqueos,
          bloqueado_hasta = now() + private.duracion_bloqueo_escalada(v_bloqueos)
      where usuario_id = p_usuario_id;
    else
      update public.intentos_login
      set fallidos = v_fallidos,
          bloqueado_hasta = null
      where usuario_id = p_usuario_id;
    end if;
    return null;
  end if;

  -- Success: reset both counters and open a session.
  update public.intentos_login
  set fallidos = 0,
      bloqueado_hasta = null,
      bloqueos = 0
  where usuario_id = p_usuario_id;

  insert into public.sesiones (usuario_id)
  values (p_usuario_id)
  returning id into v_sesion_id;

  return v_sesion_id;
end;
$$;

-- J4: desbloquear_usuario now also resets the consecutive-lock counter, so
-- an admin unlock fully clears the escalation history, not just the
-- current lock. Same signature, so `create or replace` applies cleanly and
-- keeps the existing grants (tied to the function's OID, not its body).
create or replace function public.desbloquear_usuario(p_usuario_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.intentos_login
  set fallidos = 0,
      bloqueado_hasta = null,
      bloqueos = 0
  where usuario_id = p_usuario_id;
$$;
