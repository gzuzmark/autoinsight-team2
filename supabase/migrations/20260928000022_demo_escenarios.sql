-- G3: predefined back-office scenarios. Each preset resets to seed (reusing
-- private.reiniciar_estado_demo(), migration 20260928000021) and then applies
-- a deterministic set of alerts/KPI readings -- a real state the domain
-- rules could produce (D25/D30: a KPI-linked open alert holds its indicator
-- in that alert's band; D26: every other indicator recovers to ok). The
-- active scenario is tracked so the back office can mark it "Activo"; a
-- plain reset or a shift simulation both invalidate it (see below).

-- ---------------------------------------------------------------------------
-- 1. Active-scenario bookkeeping (singleton row, never exposed directly).
-- ---------------------------------------------------------------------------

create table private.demo_configuracion (
  id boolean primary key default true,
  escenario_activo text,
  constraint demo_configuracion_singleton check (id),
  constraint demo_configuracion_escenario_check check (
    escenario_activo is null
    or escenario_activo in ('todo-ok', 'linea3-parar-alta', 'muchas-media', 'recuperacion')
  )
);

comment on table private.demo_configuracion is
  'Singleton row (id always true) tracking which back-office scenario (G3) is currently '
  'considered exact, or null when none is (never applied, reset, or invalidated by a shift).';

insert into private.demo_configuracion (id, escenario_activo) values (true, null);

-- private.reiniciar_estado_demo() (migration 20260928000021) is redefined
-- here (same body, plus clearing the active scenario) so a plain reset
-- always means "Estado inicial" -- no scenario active.
create or replace function private.reiniciar_estado_demo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linea3_id uuid;
begin
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

  -- G3: a reset always clears the active scenario back to "none".
  update private.demo_configuracion set escenario_activo = null;

  select id into v_linea3_id from public.lineas where nombre = 'Línea 3 · Motores';
  if v_linea3_id is not null then
    perform private.sembrar_alertas_linea3(v_linea3_id);
  end if;
end;
$$;

-- private.simular_turno_en_linea() (latest body from migration
-- 20260926000020_simular_turno_lectura_mas_grave.sql -- NOT migration
-- 18's original: 020 dropped the v_claves exclusion so a new milder alert
-- can never override a more severe still-open one on the same KPI) is
-- redefined here (same body, plus clearing the active scenario) -- a shift
-- makes a previously-applied scenario no longer exact.
create or replace function private.simular_turno_en_linea(p_linea_id uuid, p_cantidad int default 2)
returns setof public.alertas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_disponibles int;
  v_alertas public.alertas[];
begin
  select count(*) into v_disponibles
  from public.plantillas_alerta t
  where not exists (
    select 1 from public.alertas a
    where a.linea_id = p_linea_id and a.titulo = t.titulo and a.estado = 'nueva'
  );

  if v_disponibles < greatest(p_cantidad, 0) then
    update public.alertas
    set estado = 'no_aplica',
        resuelta_en = now(),
        resuelta_por = null
    where id in (
      select a.id
      from public.alertas a
      where a.linea_id = p_linea_id
        and a.estado = 'nueva'
        and a.titulo in (select t.titulo from public.plantillas_alerta t)
      order by a.creada_en asc
      limit greatest(p_cantidad, 0) - v_disponibles
      for update skip locked
    );
  end if;

  select array_agg(a) into v_alertas
  from public.demo_generar_alertas(p_linea_id, p_cantidad) a;

  -- No exclusions: every KPI with an open linked alert (including the ones
  -- just generated) is re-read from its MOST SEVERE open alert; KPIs
  -- without open linked alerts recover one step (D26/D30).
  perform private.recuperar_indicadores(p_linea_id, '{}'::text[]);

  -- G3: a shift invalidates any previously-applied scenario.
  update private.demo_configuracion set escenario_activo = null;

  if v_alertas is not null then
    return query select * from unnest(v_alertas);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Scenario application.
-- ---------------------------------------------------------------------------

-- Every value below is deliberately literal (not drawn from
-- plantillas_alerta/demo_generar_alertas' random pick) so each scenario is
-- fully deterministic and reproducible for a guerrilla-testing session --
-- same rationale as private.sembrar_alertas_linea3. Thresholds match
-- supabase/seed.sql's indicadores insert (fpy atencion<92/parar<90; dph
-- atencion>4/parar>6; scrap atencion>2/parar>3), identical across lines.
create function private.aplicar_escenario(p_escenario text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l3 uuid;
  v_ana uuid;
begin
  if p_escenario not in ('todo-ok', 'linea3-parar-alta', 'muchas-media', 'recuperacion') then
    raise exception 'Escenario desconocido: %', p_escenario using errcode = '22023';
  end if;

  -- Reset first (D28-style requirement in the brief: "Every scenario must
  -- yield a state the real domain rules could produce" starting clean, and
  -- "scenarios also clear sessions/lockouts like reset").
  perform private.reiniciar_estado_demo();
  select id into v_l3 from public.lineas where nombre = 'Línea 3 · Motores';

  -- Every scenario below defines its OWN alert set from scratch (the reset
  -- above already reseeded Línea 3's 7 starting alerts -- clear them).
  delete from public.alertas;

  -- Baseline: every KPI on every line lands solidly in ok (overridden below
  -- per scenario/line as needed). Línea 2's seeded baseline is atencion on
  -- all three KPIs (see seed.sql), so this also fixes it for "todo-ok".
  update public.indicadores set valor = case clave
      when 'fpy' then 96
      when 'dph' then 2
      when 'scrap' then 1
    end,
    actualizado_en = now();

  if p_escenario = 'linea3-parar-alta' then
    update public.indicadores
    set valor = 88.4, actualizado_en = now()
    where linea_id = v_l3 and clave = 'fpy';

    insert into public.alertas (linea_id, estacion_id, severidad, titulo, valor, limite, unidad, creada_en, estado)
    values (
      v_l3,
      (select id from public.estaciones where linea_id = v_l3 and numero = 4),
      'parar', 'FPY por debajo del 90 %', 88.4, 90, '%', now() - interval '2 minutes', 'nueva'
    );

  elsif p_escenario = 'muchas-media' then
    update public.indicadores
    set valor = 5, actualizado_en = now()
    where linea_id = v_l3 and clave = 'dph';

    insert into public.alertas (linea_id, estacion_id, severidad, titulo, valor, limite, unidad, creada_en, estado)
    values
      (v_l3, (select id from public.estaciones where linea_id = v_l3 and numero = 2),
       'atencion', 'Defectos por hora en aumento', 5, 4, 'defectos/h', now() - interval '5 minutes', 'nueva'),
      (v_l3, (select id from public.estaciones where linea_id = v_l3 and numero = 3),
       'atencion', 'Retrabajo sobre lo esperado', 7.2, 5, '%', now() - interval '9 minutes', 'nueva'),
      (v_l3, (select id from public.estaciones where linea_id = v_l3 and numero = 5),
       'atencion', 'Temperatura de horno alta', 185, 180, '°C', now() - interval '14 minutes', 'nueva'),
      (v_l3, (select id from public.estaciones where linea_id = v_l3 and numero = 6),
       'atencion', 'Vibración anómala en banda', 3.1, 2.5, 'mm/s', now() - interval '18 minutes', 'nueva'),
      (v_l3, (select id from public.estaciones where linea_id = v_l3 and numero = 7),
       'atencion', 'Torque fuera de rango', 9.2, 10, 'Nm', now() - interval '22 minutes', 'nueva');

  elsif p_escenario = 'recuperacion' then
    select id into v_ana from public.usuarios where nombre = 'Ana Ríos';

    insert into public.alertas (
      linea_id, estacion_id, severidad, titulo, valor, limite, unidad, creada_en, estado, resuelta_en, resuelta_por
    )
    values
      (v_l3, (select id from public.estaciones where linea_id = v_l3 and numero = 4),
       'parar', 'FPY por debajo del 90 %', 88.4, 90, '%', now() - interval '40 minutes', 'atendida',
       now() - interval '25 minutes', v_ana),
      (v_l3, (select id from public.estaciones where linea_id = v_l3 and numero = 7),
       'parar', 'Torque fuera de rango', 12.5, 10, 'Nm', now() - interval '35 minutes', 'no_aplica',
       now() - interval '20 minutes', null);
  end if;
  -- 'todo-ok' needs no further mutation: reset + the ok baseline above +
  -- no alerts is exactly the scenario.

  update private.demo_configuracion set escenario_activo = p_escenario;
end;
$$;

revoke execute on function private.aplicar_escenario(text) from public, anon, authenticated;
grant execute on function private.aplicar_escenario(text) to service_role, postgres;

create function public.demo_aplicar_escenario(p_escenario text)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.aplicar_escenario(p_escenario);
$$;

comment on function public.demo_aplicar_escenario(text) is
  'Aplica un escenario predefinido (reinicia y luego fija un estado determinista): '
  '''todo-ok'', ''linea3-parar-alta'', ''muchas-media'' o ''recuperacion''. '
  'Ejemplo: select demo_aplicar_escenario(''linea3-parar-alta'');';

revoke execute on function public.demo_aplicar_escenario(text) from public, anon, authenticated;
grant execute on function public.demo_aplicar_escenario(text) to service_role, postgres;

-- ---------------------------------------------------------------------------
-- 3. Active-scenario read for the back office.
-- ---------------------------------------------------------------------------

create function public.demo_estado_activo()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select escenario_activo from private.demo_configuracion where id;
$$;

comment on function public.demo_estado_activo() is
  'Id del escenario actualmente activo (G3), o null si ninguno lo está.';

revoke execute on function public.demo_estado_activo() from public, anon, authenticated;
grant execute on function public.demo_estado_activo() to service_role, postgres;
