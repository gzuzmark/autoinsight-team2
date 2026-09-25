-- Floor dashboard schema (clean rewrite, D15-D18).
--
-- Identifiers are Spanish, matching the app contracts (D16). Comments are in
-- English. Every table is created with row level security ENABLED and NO
-- policies for anon/authenticated: only service_role/postgres can read or
-- write (D17). All data access from the browser goes through Next.js route
-- handlers using the Supabase secret (service_role) key, never the anon key.

create extension if not exists pgcrypto with schema extensions;

-- Helpers and RPC internals that must never be reachable through PostgREST.
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Declaration order matters: Postgres compares/sorts enum values by this
-- order, so "order by severidad" alone yields parar > atencion > ok, which
-- matches the app's severity rank (lib/domain/alerts.ts SEVERITY_RANK).
create type public.severidad as enum ('parar', 'atencion', 'ok');

create type public.estado_alerta as enum ('nueva', 'atendida', 'no_aplica');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.plantas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  creada_en timestamptz not null default now()
);

create table public.lineas (
  id uuid primary key default gen_random_uuid(),
  planta_id uuid not null references public.plantas (id) on delete cascade,
  nombre text not null,
  turno text not null,
  creada_en timestamptz not null default now(),
  unique (planta_id, nombre)
);

create table public.estaciones (
  id uuid primary key default gen_random_uuid(),
  linea_id uuid not null references public.lineas (id) on delete cascade,
  numero int not null check (numero > 0),
  nombre text not null,
  creada_en timestamptz not null default now(),
  unique (linea_id, numero)
);

create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  linea_id uuid not null references public.lineas (id) on delete restrict,
  nombre text not null,
  iniciales text not null check (char_length(iniciales) between 1 and 3),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- PIN hash lives in its own table so a leaked `usuarios` row never carries
-- credential material.
create table public.usuarios_pin (
  usuario_id uuid primary key references public.usuarios (id) on delete cascade,
  pin_hash text not null
);

-- Login lockout counter, one row per user. Thresholds live in
-- private.max_intentos_fallidos() / private.duracion_bloqueo() (see the
-- functions migration) so they are defined and commented in exactly one
-- place instead of being repeated as magic numbers.
create table public.intentos_login (
  usuario_id uuid primary key references public.usuarios (id) on delete cascade,
  fallidos int not null default 0,
  bloqueado_hasta timestamptz
);

create table public.sesiones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  inicio timestamptz not null default now(),
  fin timestamptz
);

create index sesiones_usuario_inicio_idx on public.sesiones (usuario_id, inicio desc);

create table public.indicadores (
  id uuid primary key default gen_random_uuid(),
  linea_id uuid not null references public.lineas (id) on delete cascade,
  clave text not null,
  nombre text not null,
  valor numeric not null,
  unidad text not null,
  estado public.severidad not null,
  detalle text not null,
  orden int not null default 0,
  actualizado_en timestamptz not null default now(),
  unique (linea_id, clave)
);

-- Resolution rule (design decision, documented here because there is no
-- other single place for it): "atendida" always requires a human resolver,
-- because the system (demo_autoresolver) never marks an alert attended, only
-- not-applicable. "no_aplica" may come from a user (resuelta_por set) or
-- from the system (resuelta_por left null). "nueva" never has resolution
-- data. This is enforced below instead of adding a separate
-- "resuelta_por_sistema" flag, which would let resuelta_por/resuelta_en
-- disagree about whether the alert was resolved at all.
create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  linea_id uuid not null references public.lineas (id) on delete cascade,
  estacion_id uuid references public.estaciones (id) on delete set null,
  severidad public.severidad not null,
  titulo text not null check (char_length(titulo) <= 80),
  estado public.estado_alerta not null default 'nueva',
  valor numeric,
  limite numeric,
  unidad text,
  creada_en timestamptz not null default now(),
  resuelta_por uuid references public.usuarios (id) on delete set null,
  resuelta_en timestamptz,
  constraint alertas_resolucion_check check (
    (estado = 'nueva' and resuelta_en is null and resuelta_por is null)
    or (estado = 'atendida' and resuelta_en is not null and resuelta_por is not null)
    or (estado = 'no_aplica' and resuelta_en is not null)
  )
);

-- Serves "active alerts for a line, most severe first, newest first": the
-- enum's declaration order already sorts parar before atencion before ok.
create index alertas_linea_activas_idx
  on public.alertas (linea_id, severidad, creada_en desc)
  where estado = 'nueva';

-- Catalog used only by the demo/simulator RPCs (B3/B6), never by the app UI.
create table public.plantillas_alerta (
  id uuid primary key default gen_random_uuid(),
  severidad public.severidad not null,
  titulo text not null check (char_length(titulo) <= 80),
  estacion_numero int not null check (estacion_numero > 0),
  unidad text not null,
  valor_min numeric not null,
  valor_max numeric not null check (valor_max >= valor_min),
  limite numeric not null,
  peso int not null check (peso > 0)
);

-- ---------------------------------------------------------------------------
-- Row level security: enabled everywhere, no policies for anon/authenticated.
-- ---------------------------------------------------------------------------

alter table public.plantas enable row level security;
alter table public.lineas enable row level security;
alter table public.estaciones enable row level security;
alter table public.usuarios enable row level security;
alter table public.usuarios_pin enable row level security;
alter table public.intentos_login enable row level security;
alter table public.sesiones enable row level security;
alter table public.indicadores enable row level security;
alter table public.alertas enable row level security;
alter table public.plantillas_alerta enable row level security;

-- ---------------------------------------------------------------------------
-- Grants: revoke everything from anon/authenticated, including the default
-- privileges Supabase would otherwise apply to future objects. service_role
-- and postgres keep full access (service_role bypasses RLS by design).
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema private revoke all on tables from anon, authenticated;
alter default privileges in schema private revoke all on functions from anon, authenticated;

revoke all on schema private from anon, authenticated;

-- Grant service_role (the only Data API role that reaches these tables,
-- always through a route handler and, for writes, through a SECURITY
-- DEFINER RPC) explicit, self-contained access. This does not rely on the
-- project's `auto_expose_new_tables` default (turned off in config.toml,
-- see its comment there, and not guaranteed the same on every remote
-- project), so the grant is identical locally and after the B8 cutover.
grant usage on schema public to service_role;
grant usage on schema private to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema private grant all on tables to service_role;
