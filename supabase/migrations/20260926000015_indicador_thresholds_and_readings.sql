-- Phase D (D24-D25): KPI tiles follow measurements.
--
-- Today `indicadores.estado` is a plain column set once by seed.sql and
-- never touched again, so a tile's state word can silently disagree with
-- its `valor`. This migration:
--   1. Adds a direction + two thresholds per indicator (mayor_es_mejor,
--      umbral_atencion, umbral_parar) and derives `estado` from `valor` via
--      a GENERATED column, so the two can never drift apart (D24).
--   2. Links a demo template to a KPI (`plantillas_alerta.indicador_clave`);
--      `demo_generar_alertas` now records that alert's generated valor as a
--      new reading on the line's matching indicador (D25).
--
-- `resolver_alerta` is NOT touched by this migration and never will be:
-- operator resolution must never change a KPI (see
-- supabase/tests/09_indicadores_lecturas.test.sql). The next migration
-- (20260926000016) adds the D26 "recovery reading" on top of this one.

-- ---------------------------------------------------------------------------
-- 1. Thresholds + derived estado.
-- ---------------------------------------------------------------------------

alter table public.indicadores
  add column mayor_es_mejor boolean,
  add column umbral_atencion numeric,
  add column umbral_parar numeric;

-- Backfill from the only 3 claves this app has ever had (fpy/dph/scrap),
-- matching the discovery-accepted bands (D24): FPY is higher-is-better
-- (atencion < 92, parar < 90); Defectos/hora and Scrap are lower-is-better
-- (atencion/parar above their thresholds).
update public.indicadores
set mayor_es_mejor = (clave = 'fpy'),
    umbral_atencion = case clave
      when 'fpy' then 92
      when 'dph' then 4
      when 'scrap' then 2
      else valor -- unknown clave: thresholds equal to valor, i.e. always ok.
    end,
    umbral_parar = case clave
      when 'fpy' then 90
      when 'dph' then 6
      when 'scrap' then 3
      else valor
    end;

alter table public.indicadores
  alter column mayor_es_mejor set not null,
  alter column umbral_atencion set not null,
  alter column umbral_parar set not null;

-- Consistency: the "better" direction's threshold must be on the correct
-- side of the "worse" direction's threshold, or every valor would derive to
-- the same state.
alter table public.indicadores
  add constraint indicadores_umbrales_check check (
    (mayor_es_mejor and umbral_atencion > umbral_parar)
    or (not mayor_es_mejor and umbral_atencion < umbral_parar)
  );

-- private.estado_indicador: pure derivation, reused by the GENERATED column
-- below and by private.recuperar_indicadores. A value exactly ON a
-- threshold falls into the BETTER band (matches the discovery examples:
-- "FPY higher-is-better: atencion < 92, parar < 90"; "Defectos lower-is-
-- better: atencion > 4, parar > 6"). No SECURITY DEFINER: like the other
-- private.* constant/derivation helpers (migration 2), this touches no
-- table and needs no privilege escalation.
create function private.estado_indicador(
  p_valor numeric,
  p_mayor_es_mejor boolean,
  p_umbral_atencion numeric,
  p_umbral_parar numeric
)
returns public.severidad
language sql
immutable
set search_path = ''
as $$
  select case
    when p_mayor_es_mejor then
      case
        when p_valor < p_umbral_parar then 'parar'::public.severidad
        when p_valor < p_umbral_atencion then 'atencion'::public.severidad
        else 'ok'::public.severidad
      end
    else
      case
        when p_valor > p_umbral_parar then 'parar'::public.severidad
        when p_valor > p_umbral_atencion then 'atencion'::public.severidad
        else 'ok'::public.severidad
      end
  end
$$;

revoke execute on function private.estado_indicador(numeric, boolean, numeric, numeric) from public;
grant execute on function private.estado_indicador(numeric, boolean, numeric, numeric) to postgres, service_role;

-- Convert estado from a plain column to a GENERATED one. Nothing indexes or
-- otherwise depends on it (see migration 1's alertas index, which is on
-- alertas.severidad, a different column/table).
alter table public.indicadores drop column estado;
alter table public.indicadores
  add column estado public.severidad
    generated always as (
      private.estado_indicador(valor, mayor_es_mejor, umbral_atencion, umbral_parar)
    ) stored
    not null;

-- ---------------------------------------------------------------------------
-- 2. Template -> KPI link (D25).
-- ---------------------------------------------------------------------------

alter table public.plantillas_alerta
  add column indicador_clave text
    check (indicador_clave is null or indicador_clave in ('fpy', 'dph', 'scrap'));

-- demo_generar_alertas: unchanged weighted pick / dedupe / conflict
-- handling, plus recording the generated reading on the matching indicador
-- when the picked template links to one.
create or replace function public.demo_generar_alertas(p_linea_id uuid default null, p_cantidad int default 1)
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

    select t.* into v_plantilla
    from public.plantillas_alerta t
    where not exists (
      select 1 from public.alertas a
      where a.linea_id = v_linea_id
        and a.estado = 'nueva'
        and a.titulo = t.titulo
    )
    order by power(random(), 1.0 / t.peso) desc
    limit 1;

    if not found then
      continue; -- no available templates (all active, or none configured)
    end if;

    select e.id into v_estacion_id
    from public.estaciones e
    where e.linea_id = v_linea_id
      and e.numero = v_plantilla.estacion_numero;

    v_valor := v_plantilla.valor_min + random() * (v_plantilla.valor_max - v_plantilla.valor_min);
    v_valor := round(v_valor, 2);

    insert into public.alertas (
      linea_id, estacion_id, severidad, titulo, valor, limite, unidad
    )
    values (
      v_linea_id, v_estacion_id, v_plantilla.severidad, v_plantilla.titulo,
      v_valor, v_plantilla.limite, v_plantilla.unidad
    )
    returning id into v_id;

    -- D25: a KPI-linked template records this alert's reading on the
    -- line's matching indicador.
    if v_plantilla.indicador_clave is not null then
      update public.indicadores
      set valor = v_valor,
          actualizado_en = now()
      where linea_id = v_linea_id
        and clave = v_plantilla.indicador_clave;
    end if;

    return query select * from public.alertas a where a.id = v_id;
  end loop;
end;
$$;
