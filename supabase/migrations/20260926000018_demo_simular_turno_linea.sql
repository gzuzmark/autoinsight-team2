-- E3/D28: "Simular turno" is removed from the app UI entirely (no more
-- button, no more DEMO_ENABLED, no more POST /api/demo/simular). The only
-- way to trigger a shift now is from Supabase itself, by a human who never
-- touches SQL:
--   * `public.demo_simular_turno_linea(p_linea, p_cantidad)` -- callable
--     directly from the SQL editor with a line NAME (not a session/uuid);
--   * `public.demo_panel` (see below) -- a Table Editor row per line whose
--     `simular_turno` checkbox does the same thing with zero SQL.
--
-- Both paths must run the exact same rules "Simular turno" always has: free
-- room on a saturated line (K5), record a KPI reading for a linked template
-- (D25), then recovery for every indicator that did not get one (D26,
-- applied by the caller of demo_generar_alertas already). This migration
-- extracts that shared logic once, into `private.simular_turno_en_linea`, so
-- `demo_simular_turno` (session-based, still used by nothing after E3 but
-- kept for the pgTAP suite's existing coverage and any future session-based
-- caller) and the new name-based RPC below both delegate to it instead of
-- duplicating the free-room logic.

-- ---------------------------------------------------------------------------
-- Shared implementation (private: never reachable through PostgREST).
-- ---------------------------------------------------------------------------

-- D26: unchanged recovery rule -- after generating, every OTHER indicator of
-- the line (the ones NOT just hit by a KPI-linked template) moves one state
-- toward ok, exactly as `demo_simular_turno` already did before this
-- migration (20260926000016). Extracted here so `demo_simular_turno` and
-- the new name-based `demo_simular_turno_linea` both get it for free instead
-- of one of them silently losing D26.
create function private.simular_turno_en_linea(p_linea_id uuid, p_cantidad int default 2)
returns setof public.alertas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_disponibles int;
  v_alertas public.alertas[];
  v_claves text[];
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

  select array_agg(distinct t.indicador_clave) into v_claves
  from unnest(v_alertas) a
  join public.plantillas_alerta t on t.titulo = a.titulo
  where t.indicador_clave is not null;

  perform private.recuperar_indicadores(p_linea_id, coalesce(v_claves, '{}'::text[]));

  if v_alertas is not null then
    return query select * from unnest(v_alertas);
  end if;
end;
$$;

revoke execute on function private.simular_turno_en_linea(uuid, int) from public, anon, authenticated;
grant execute on function private.simular_turno_en_linea(uuid, int) to service_role, postgres;

-- ---------------------------------------------------------------------------
-- Session-based RPC (kept for existing callers/tests): now a thin wrapper.
-- ---------------------------------------------------------------------------

create or replace function public.demo_simular_turno(p_sesion_id uuid, p_cantidad int default 2)
returns setof public.alertas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linea_id uuid;
begin
  select linea_id into v_linea_id
  from private.validar_sesion(p_sesion_id);

  return query select * from private.simular_turno_en_linea(v_linea_id, p_cantidad);
end;
$$;

revoke execute on function public.demo_simular_turno(uuid, int) from public, anon, authenticated;
grant execute on function public.demo_simular_turno(uuid, int) to service_role;

-- ---------------------------------------------------------------------------
-- Name-based RPC: the SQL-editor-friendly entry point (D28). No session --
-- resolves the line by its exact display name, so a non-technical user can
-- run `select * from demo_simular_turno_linea('Línea 3 · Motores');` from the
-- Supabase dashboard's SQL editor (which runs as `postgres`).
-- ---------------------------------------------------------------------------

create function public.demo_simular_turno_linea(p_linea text default 'Línea 3 · Motores', p_cantidad int default 2)
returns setof public.alertas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linea_id uuid;
begin
  select id into v_linea_id
  from public.lineas
  where nombre = p_linea;

  if not found then
    raise exception 'Línea no encontrada: %', p_linea using errcode = 'P0002';
  end if;

  return query select * from private.simular_turno_en_linea(v_linea_id, p_cantidad);
end;
$$;

comment on function public.demo_simular_turno_linea(text, int) is
  'Simula un cambio de turno en la línea indicada (por nombre exacto): genera alertas nuevas '
  'siguiendo las mismas reglas que el botón "Simular turno" que tenía la app. '
  'Ejemplo: select * from demo_simular_turno_linea(''Línea 3 · Motores'');';

revoke execute on function public.demo_simular_turno_linea(text, int) from public, anon, authenticated;
grant execute on function public.demo_simular_turno_linea(text, int) to service_role, postgres;

-- ---------------------------------------------------------------------------
-- Table Editor control panel: one row per line, no SQL required (D28).
-- ---------------------------------------------------------------------------

create table public.demo_panel (
  linea_id uuid primary key references public.lineas (id) on delete cascade,
  linea text not null,
  simular_turno boolean not null default false,
  cantidad int not null default 2 check (cantidad between 1 and 5),
  ultima_simulacion timestamptz,
  alertas_generadas int
);

comment on table public.demo_panel is
  'Panel de simulación de turno, uno por línea. Para simular un turno: marca la casilla '
  '"simular_turno" en TRUE y espera hasta 15 segundos -- el tablero de esa línea mostrará '
  'las alertas nuevas. La casilla vuelve sola a FALSE cuando termina.';
comment on column public.demo_panel.linea is
  'Nombre de la línea (solo para leer en el Table Editor; el nombre real vive en "lineas").';
comment on column public.demo_panel.simular_turno is
  'Poné TRUE para simular un turno en esta línea. Vuelve a FALSE automáticamente al terminar.';
comment on column public.demo_panel.cantidad is
  'Cuántas alertas nuevas generar (1 a 5). Por defecto 2, igual que el botón que tenía la app.';
comment on column public.demo_panel.ultima_simulacion is
  'Cuándo se simuló un turno por última vez en esta línea (se completa solo).';
comment on column public.demo_panel.alertas_generadas is
  'Cuántas alertas generó la última simulación en esta línea (se completa solo).';

alter table public.demo_panel enable row level security;

-- BEFORE INSERT OR UPDATE: whenever a row is written with simular_turno =
-- true (whether that came from an UPDATE in the Table Editor -- the normal
-- path -- or an INSERT that sets it directly), run the shift simulation
-- synchronously, record its outcome, and reset the flag, all inside the same
-- row write (no separate UPDATE statement needed: a BEFORE trigger can just
-- rewrite NEW).
create function private.demo_panel_simular()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_generadas int;
begin
  if new.simular_turno is not true then
    return new;
  end if;

  select count(*) into v_generadas
  from private.simular_turno_en_linea(new.linea_id, new.cantidad);

  new.simular_turno := false;
  new.ultima_simulacion := now();
  new.alertas_generadas := v_generadas;
  return new;
end;
$$;

create trigger demo_panel_simular_trigger
  before insert or update on public.demo_panel
  for each row
  execute function private.demo_panel_simular();

-- AFTER INSERT on lineas: every new line automatically gets a demo_panel
-- row, so the control panel never falls out of sync with the lines table.
create function private.lineas_crear_panel_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.demo_panel (linea_id, linea)
  values (new.id, new.nombre)
  on conflict (linea_id) do nothing;
  return new;
end;
$$;

create trigger lineas_crear_panel_demo_trigger
  after insert on public.lineas
  for each row
  execute function private.lineas_crear_panel_demo();

-- Backfill: one demo_panel row per existing line (same guard pattern as
-- migration 20260926000017's backfill -- on a fresh database `lineas` is
-- still empty when migrations run, since seed.sql loads afterwards, so this
-- is a no-op there and seed.sql is the single source of those rows instead).
insert into public.demo_panel (linea_id, linea)
select l.id, l.nombre
from public.lineas l
where exists (select 1 from public.lineas)
  and not exists (select 1 from public.demo_panel p where p.linea_id = l.id);
