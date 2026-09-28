-- G2: facilitator back office needs two more demo controls beyond the
-- existing "Simular turno" RPC (demo_simular_turno_linea, migration 18):
--
--   1. `public.demo_reiniciar()` -- restores the floor to its seeded
--      initial state (alerts, KPI readings, demo_panel bookkeeping,
--      sessions/login lockouts) between guerrilla-testing participants.
--      Users/PINs/plants/lines/stations are structural data and are never
--      touched by a reset.
--   2. `public.demo_estado_lineas()` -- one row per line (nombre, worst
--      active-alert severidad, open alert count, last-shift timestamp) so
--      the back office's "Estado de la demo" card reads live data instead
--      of a static sample.
--
-- Both are SECURITY DEFINER, callable only by service_role/postgres (same
-- grant pattern as every other demo_* function -- never anon/authenticated,
-- never reachable through PostgREST from the browser).

-- ---------------------------------------------------------------------------
-- 1. Reset.
-- ---------------------------------------------------------------------------

-- Seed-reuse (avoids the reset drifting from supabase/seed.sql, per the D28
-- amendment's reset requirement): seed.sql's Línea 3 starting-alerts insert
-- is extracted into this private function, which BOTH seed.sql and
-- demo_reiniciar() call, so there is exactly one place that data lives.
create function private.sembrar_alertas_linea3(p_linea_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.alertas (linea_id, estacion_id, severidad, titulo, valor, limite, unidad, creada_en)
  values
    (
      p_linea_id,
      (select id from public.estaciones where linea_id = p_linea_id and numero = 4),
      'parar', 'FPY por debajo del 90 %', 88.4, 90, '%', now() - interval '2 minutes'
    ),
    (
      p_linea_id,
      (select id from public.estaciones where linea_id = p_linea_id and numero = 7),
      'parar', 'Torque fuera de rango', 12.5, 10, 'Nm', now() - interval '6 minutes'
    ),
    (
      p_linea_id,
      (select id from public.estaciones where linea_id = p_linea_id and numero = 2),
      'atencion', 'Defectos por hora en aumento', 5, 4, 'defectos/h', now() - interval '11 minutes'
    ),
    (
      p_linea_id,
      (select id from public.estaciones where linea_id = p_linea_id and numero = 5),
      'atencion', 'Temperatura de horno alta', 185, 180, '°C', now() - interval '18 minutes'
    ),
    (
      p_linea_id,
      (select id from public.estaciones where linea_id = p_linea_id and numero = 3),
      'atencion', 'Retrabajo sobre lo esperado', 7.2, 5, '%', now() - interval '24 minutes'
    ),
    (
      p_linea_id,
      (select id from public.estaciones where linea_id = p_linea_id and numero = 1),
      'ok', 'Calibración completada', null, null, null, now() - interval '40 minutes'
    ),
    (
      p_linea_id, null,
      'ok', 'Turno anterior sin scrap', null, null, null, now() - interval '55 minutes'
    );
end;
$$;

revoke execute on function private.sembrar_alertas_linea3(uuid) from public, anon, authenticated;
grant execute on function private.sembrar_alertas_linea3(uuid) to service_role, postgres;

-- Seeded KPI readings, matching supabase/seed.sql's `indicadores` insert
-- (kept as literal data here rather than a shared function, since it is a
-- plain per-(linea, clave) value update, not a multi-row insert with FKs to
-- resolve -- covered instead by the "reset parity" pgTAP test below, which
-- fails if this ever drifts from seed.sql).
create function private.reiniciar_estado_demo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linea3_id uuid;
begin
  -- G2 D-decision: a reset also clears login lockouts (public.intentos_login)
  -- and every open/closed session (public.sesiones), so "since last visit"
  -- state and PIN lockouts start clean for the next participant -- but never
  -- touches usuarios/usuarios_pin themselves (users/PINs stay put, as
  -- required by the task brief).
  delete from public.alertas;
  delete from public.sesiones;
  delete from public.intentos_login;

  update public.indicadores i
  set valor = s.valor, actualizado_en = now()
  from (
    values
      ('Línea 3 · Motores', 'fpy', 88.4::numeric),
      ('Línea 3 · Motores', 'dph', 5::numeric),
      ('Línea 3 · Motores', 'scrap', 1.6::numeric),
      ('Línea 1 · Chasis', 'fpy', 94.2::numeric),
      ('Línea 1 · Chasis', 'dph', 2::numeric),
      ('Línea 1 · Chasis', 'scrap', 0.9::numeric),
      ('Línea 2 · Pintura', 'fpy', 90.1::numeric),
      ('Línea 2 · Pintura', 'dph', 4.5::numeric),
      ('Línea 2 · Pintura', 'scrap', 2.4::numeric)
  ) as s(linea_nombre, clave, valor)
  join public.lineas l on l.nombre = s.linea_nombre
  where i.linea_id = l.id and i.clave = s.clave;

  update public.demo_panel
  set ultima_simulacion = null, alertas_generadas = null, simular_turno = false, cantidad = 2;

  select id into v_linea3_id from public.lineas where nombre = 'Línea 3 · Motores';
  if v_linea3_id is not null then
    perform private.sembrar_alertas_linea3(v_linea3_id);
  end if;
end;
$$;

revoke execute on function private.reiniciar_estado_demo() from public, anon, authenticated;
grant execute on function private.reiniciar_estado_demo() to service_role, postgres;

create function public.demo_reiniciar()
returns void
language sql
security definer
set search_path = ''
as $$
  select private.reiniciar_estado_demo();
$$;

comment on function public.demo_reiniciar() is
  'Reinicia la demo al estado inicial (seed): borra alertas, sesiones y bloqueos de login, y '
  'restaura las lecturas de KPI. No modifica usuarios ni PINs. Ejemplo: select demo_reiniciar();';

revoke execute on function public.demo_reiniciar() from public, anon, authenticated;
grant execute on function public.demo_reiniciar() to service_role, postgres;

-- ---------------------------------------------------------------------------
-- 2. Live per-line status for the back office.
-- ---------------------------------------------------------------------------

create function public.demo_estado_lineas()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.nombre), '[]'::jsonb)
  from (
    select
      l.nombre,
      coalesce(
        (
          select a.severidad::text
          from public.alertas a
          where a.linea_id = l.id and a.estado = 'nueva'
          order by case a.severidad when 'parar' then 0 when 'atencion' then 1 else 2 end
          limit 1
        ),
        'ok'
      ) as estado,
      (select count(*)::int from public.alertas a where a.linea_id = l.id and a.estado = 'nueva') as alertas_abiertas,
      dp.ultima_simulacion
    from public.lineas l
    left join public.demo_panel dp on dp.linea_id = l.id
  ) t;
$$;

comment on function public.demo_estado_lineas() is
  'Estado por línea para el back office: nombre, severidad de la alerta activa más grave (u '
  '"ok" si no hay ninguna), cantidad de alertas abiertas y última simulación de turno.';

revoke execute on function public.demo_estado_lineas() from public, anon, authenticated;
grant execute on function public.demo_estado_lineas() to service_role, postgres;
