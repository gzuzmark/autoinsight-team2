-- Session, dashboard and alert-resolution RPCs (D17/D18, B3).
--
-- Every callable RPC lives in `public` (so PostgREST can expose it) but
-- EXECUTE is granted ONLY to service_role; helpers live in `private`, which
-- is never exposed at all. Every function is SECURITY DEFINER with
-- `set search_path = ''` and fully qualifies every name it uses, so it
-- cannot be tricked by a search_path injected through a session variable and
-- does not depend on RLS (it runs as the owning role, which is not subject
-- to the empty policy set on these tables).

-- ---------------------------------------------------------------------------
-- Constants, defined once and commented (private.*), instead of magic
-- numbers repeated across functions.
-- ---------------------------------------------------------------------------

-- Failed PIN attempts allowed before a user is locked out.
create function private.max_intentos_fallidos()
returns int
language sql
immutable
set search_path = ''
as $$ select 5 $$;

-- How long a user stays locked out after private.max_intentos_fallidos()
-- consecutive failures.
create function private.duracion_bloqueo()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '5 minutes' $$;

-- How long a session stays valid after it starts (sesiones.fin is still
-- null).
create function private.duracion_sesion()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '12 hours' $$;

-- An indicador is "desactualizado" (stale) once it is older than this.
create function private.umbral_indicador_desactualizado()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '15 minutes' $$;

-- ---------------------------------------------------------------------------
-- private.validar_sesion: shared session-validity check used by every RPC
-- that takes a p_sesion_id. Raises errcode 28000 (invalid_authorization
-- specification) on any invalid session, so callers cannot distinguish
-- "unknown session" from "expired session" from "user disabled".
-- ---------------------------------------------------------------------------

create function private.validar_sesion(p_sesion_id uuid)
returns table (usuario_id uuid, linea_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    select u.id, u.linea_id
    from public.sesiones s
    join public.usuarios u on u.id = s.usuario_id
    where s.id = p_sesion_id
      and s.fin is null
      and s.inicio > now() - private.duracion_sesion()
      and u.activo;

  if not found then
    raise exception 'Invalid session.' using errcode = '28000';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- public.usuarios_login: active users for the avatar grid. No PIN data.
-- ---------------------------------------------------------------------------

create function public.usuarios_login()
returns table (id uuid, nombre text, iniciales text, color text)
language sql
security definer
set search_path = ''
as $$
  select u.id, u.nombre, u.iniciales, u.color
  from public.usuarios u
  where u.activo
  order by u.nombre;
$$;

-- ---------------------------------------------------------------------------
-- public.iniciar_sesion: PIN login with lockout. Returns the new session id
-- on success, or null on any failure (unknown user, inactive user, wrong
-- PIN, or locked out) -- the same shape for every failure so the caller
-- cannot enumerate valid users.
-- ---------------------------------------------------------------------------

create function public.iniciar_sesion(p_usuario_id uuid, p_pin text)
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
  select p.pin_hash, u.activo, il.bloqueado_hasta, coalesce(il.fallidos, 0)
    into v_pin_hash, v_activo, v_bloqueado_hasta, v_fallidos
  from public.usuarios u
  left join public.usuarios_pin p on p.usuario_id = u.id
  left join public.intentos_login il on il.usuario_id = u.id
  where u.id = p_usuario_id;

  -- Unknown user: behave exactly like a locked-out/wrong-PIN user (null),
  -- do not touch intentos_login (there is nothing to key it on).
  if not found or v_pin_hash is null or not v_activo then
    return null;
  end if;

  if v_bloqueado_hasta is not null and v_bloqueado_hasta > now() then
    return null;
  end if;

  if v_pin_hash <> extensions.crypt(p_pin, v_pin_hash) then
    v_fallidos := v_fallidos + 1;
    insert into public.intentos_login (usuario_id, fallidos, bloqueado_hasta)
    values (
      p_usuario_id,
      v_fallidos,
      case
        when v_fallidos >= private.max_intentos_fallidos() then now() + private.duracion_bloqueo()
        else null
      end
    )
    on conflict (usuario_id) do update
      set fallidos = excluded.fallidos,
          bloqueado_hasta = excluded.bloqueado_hasta;
    return null;
  end if;

  -- Success: reset the counter and open a session.
  insert into public.intentos_login (usuario_id, fallidos, bloqueado_hasta)
  values (p_usuario_id, 0, null)
  on conflict (usuario_id) do update
    set fallidos = 0,
        bloqueado_hasta = null;

  insert into public.sesiones (usuario_id)
  values (p_usuario_id)
  returning id into v_sesion_id;

  return v_sesion_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- public.cerrar_sesion: idempotent close. Unknown/already-closed session ids
-- are a silent no-op (closing is not a sensitive operation, unlike opening).
-- ---------------------------------------------------------------------------

create function public.cerrar_sesion(p_sesion_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.sesiones
  set fin = now()
  where id = p_sesion_id
    and fin is null;
$$;

-- ---------------------------------------------------------------------------
-- public.tablero: the dashboard payload for one session.
-- ---------------------------------------------------------------------------

create function public.tablero(p_sesion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid;
  v_linea_id uuid;
  v_ultima_visita timestamptz;
  v_result jsonb;
begin
  select usuario_id, linea_id into v_usuario_id, v_linea_id
  from private.validar_sesion(p_sesion_id);

  -- Last visit = the end of the user's previous (already-closed) session,
  -- excluding the current one. Null means first visit ever.
  select max(s.fin) into v_ultima_visita
  from public.sesiones s
  where s.usuario_id = v_usuario_id
    and s.id <> p_sesion_id
    and s.fin is not null;

  select jsonb_build_object(
    'planta', (
      select jsonb_build_object('nombre', pl.nombre)
      from public.lineas l
      join public.plantas pl on pl.id = l.planta_id
      where l.id = v_linea_id
    ),
    'linea', (
      select jsonb_build_object('nombre', l.nombre, 'turno', l.turno)
      from public.lineas l
      where l.id = v_linea_id
    ),
    'usuario', (
      select jsonb_build_object(
        'id', u.id, 'nombre', u.nombre, 'iniciales', u.iniciales, 'color', u.color
      )
      from public.usuarios u
      where u.id = v_usuario_id
    ),
    'indicadores', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'clave', i.clave,
          'nombre', i.nombre,
          'estado', i.estado,
          'detalle', i.detalle,
          'valor', i.valor,
          'unidad', i.unidad,
          'actualizado_en', i.actualizado_en,
          'desactualizado', i.actualizado_en < now() - private.umbral_indicador_desactualizado()
        )
        order by i.orden
      ), '[]'::jsonb)
      from public.indicadores i
      where i.linea_id = v_linea_id
    ),
    'alertas', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'severidad', a.severidad,
          'titulo', a.titulo,
          'estacion', case
            when e.numero is not null then 'Estación ' || e.numero || ' · ' || e.nombre
            else null
          end,
          'valor', a.valor,
          'limite', a.limite,
          'unidad', a.unidad,
          'creada_en', a.creada_en
        )
        order by a.severidad, a.creada_en desc
      ), '[]'::jsonb)
      from public.alertas a
      left join public.estaciones e on e.id = a.estacion_id
      where a.linea_id = v_linea_id
        and a.estado = 'nueva'
    ),
    'ultima_visita', v_ultima_visita,
    'nuevas_ids', (
      select coalesce(jsonb_agg(a.id), '[]'::jsonb)
      from public.alertas a
      where a.linea_id = v_linea_id
        and a.estado = 'nueva'
        and v_ultima_visita is not null
        and a.creada_en > v_ultima_visita
    ),
    'ultima_actualizacion', (
      select coalesce(
        greatest(
          (select max(i.actualizado_en) from public.indicadores i where i.linea_id = v_linea_id),
          (select max(a.creada_en) from public.alertas a where a.linea_id = v_linea_id)
        ),
        now()
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- public.resolver_alerta: attend or dismiss an alert. Idempotent (an alert
-- that is already resolved, in any resolution, is left untouched and no
-- error is raised); cross-line access is rejected as "not found" so a
-- caller cannot probe which alert ids exist on another line.
-- ---------------------------------------------------------------------------

create function public.resolver_alerta(
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

  if p_resolucion not in ('atendida', 'no_aplica') then
    raise exception 'Invalid resolution.' using errcode = '22023';
  end if;

  select a.linea_id, a.estado into v_alerta_linea_id, v_estado
  from public.alertas a
  where a.id = p_alerta_id;

  if not found or v_alerta_linea_id <> v_linea_id then
    raise exception 'Alert not found.' using errcode = 'P0002';
  end if;

  if v_estado <> 'nueva' then
    -- Already resolved (either resolution): idempotent no-op.
    return;
  end if;

  update public.alertas
  set estado = p_resolucion,
      resuelta_por = v_usuario_id,
      resuelta_en = now()
  where id = p_alerta_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- public.demo_generar_alertas: simulator. Picks weighted-random templates
-- and inserts new active alerts, skipping a template whose titulo is
-- already active (estado = 'nueva') on the target line.
--
-- p_linea_id null means: for each of the p_cantidad alerts, pick a random
-- existing line independently (not "one random line for the whole batch").
-- ---------------------------------------------------------------------------

create function public.demo_generar_alertas(p_linea_id uuid default null, p_cantidad int default 1)
returns setof public.alertas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i int;
  v_linea_id uuid;
  v_plantilla public.plantillas_alerta%rowtype;
  v_estacion_id uuid;
  v_valor numeric;
  v_id uuid;
begin
  for v_i in 1..greatest(p_cantidad, 0) loop
    v_linea_id := p_linea_id;
    if v_linea_id is null then
      select l.id into v_linea_id
      from public.lineas l
      order by random()
      limit 1;
    end if;

    if v_linea_id is null then
      continue; -- no lines exist at all
    end if;

    -- Weighted pick: Efraimidis-Spirakis weighted sampling. Each row gets a
    -- key = random()^(1/peso); the highest key wins. Unlike a -ln(random())
    -- formula, this never raises on random() = 0 (power(0, x) = 0, just the
    -- lowest possible key), so it cannot fail at runtime.
    select t.* into v_plantilla
    from public.plantillas_alerta t
    order by power(random(), 1.0 / t.peso) desc
    limit 1;

    if not found then
      continue; -- no templates configured
    end if;

    -- Dedupe: skip if this line already has an active alert with the same
    -- title.
    if exists (
      select 1 from public.alertas a
      where a.linea_id = v_linea_id
        and a.estado = 'nueva'
        and a.titulo = v_plantilla.titulo
    ) then
      continue;
    end if;

    select e.id into v_estacion_id
    from public.estaciones e
    where e.linea_id = v_linea_id
      and e.numero = v_plantilla.estacion_numero;

    v_valor := v_plantilla.valor_min + random() * (v_plantilla.valor_max - v_plantilla.valor_min);

    insert into public.alertas (
      linea_id, estacion_id, severidad, titulo, valor, limite, unidad
    )
    values (
      v_linea_id, v_estacion_id, v_plantilla.severidad, v_plantilla.titulo,
      round(v_valor, 2), v_plantilla.limite, v_plantilla.unidad
    )
    returning id into v_id;

    return query select * from public.alertas a where a.id = v_id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- public.demo_autoresolver: marks stale active alerts "no_aplica" by the
-- system (resuelta_por stays null, see the alertas_resolucion_check
-- comment). Returns the number of alerts resolved.
-- ---------------------------------------------------------------------------

create function public.demo_autoresolver(p_antiguedad interval default '30 minutes')
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

-- ---------------------------------------------------------------------------
-- Grants: EXECUTE only for service_role. Revoke from public (the implicit
-- role) so nobody gets it by default, then from anon/authenticated
-- explicitly for clarity/defense in depth.
-- ---------------------------------------------------------------------------

-- private.* helpers: not reachable through PostgREST (private is not an
-- exposed API schema) and USAGE on the schema itself is already revoked
-- from anon/authenticated (migration 1); revoke EXECUTE from PUBLIC too so
-- a direct Postgres connection as anon/authenticated cannot call them
-- either, and so has_function_privilege() checks are meaningful in tests.
revoke execute on function private.max_intentos_fallidos() from public;
revoke execute on function private.duracion_bloqueo() from public;
revoke execute on function private.duracion_sesion() from public;
revoke execute on function private.umbral_indicador_desactualizado() from public;
revoke execute on function private.validar_sesion(uuid) from public;

grant execute on function private.max_intentos_fallidos() to postgres, service_role;
grant execute on function private.duracion_bloqueo() to postgres, service_role;
grant execute on function private.duracion_sesion() to postgres, service_role;
grant execute on function private.umbral_indicador_desactualizado() to postgres, service_role;
grant execute on function private.validar_sesion(uuid) to postgres, service_role;

revoke execute on function public.usuarios_login() from public;
revoke execute on function public.iniciar_sesion(uuid, text) from public;
revoke execute on function public.cerrar_sesion(uuid) from public;
revoke execute on function public.tablero(uuid) from public;
revoke execute on function public.resolver_alerta(uuid, uuid, public.estado_alerta) from public;
revoke execute on function public.demo_generar_alertas(uuid, int) from public;
revoke execute on function public.demo_autoresolver(interval) from public;

grant execute on function public.usuarios_login() to service_role;
grant execute on function public.iniciar_sesion(uuid, text) to service_role;
grant execute on function public.cerrar_sesion(uuid) to service_role;
grant execute on function public.tablero(uuid) to service_role;
grant execute on function public.resolver_alerta(uuid, uuid, public.estado_alerta) to service_role;
grant execute on function public.demo_generar_alertas(uuid, int) to service_role;
grant execute on function public.demo_autoresolver(interval) to service_role;
