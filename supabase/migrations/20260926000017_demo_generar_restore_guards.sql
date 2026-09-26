-- Migration 015 rewrote demo_generar_alertas to record KPI readings (D25) but
-- dropped two earlier guarantees:
--   * H4: `on conflict (linea_id, titulo) where estado = 'nueva' do nothing`,
--     so a concurrent caller (cron + "Simular turno") failed on the dedupe
--     index instead of skipping;
--   * 011: a random-line pick only considers lines that still have an
--     available template, so it could land on a saturated line and generate
--     nothing.
-- This restores both and records the KPI reading only when the alert was
-- actually inserted.
--
-- Data: databases seeded before 015 (e.g. the staging project) have templates
-- without `indicador_clave` and lack the two KPI templates, so their tiles
-- would never change. Link existing templates by titulo and add the missing
-- ones. On a fresh database this table is still empty when migrations run
-- (seed.sql loads afterwards), so nothing is inserted here and the seed stays
-- the single source of its rows.

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
    v_id := null;
    v_linea_id := p_linea_id;
    if v_linea_id is null then
      -- Only lines that still have at least one template not already active.
      select l.id into v_linea_id
      from public.lineas l
      where exists (
        select 1 from public.plantillas_alerta t
        where not exists (
          select 1 from public.alertas a
          where a.linea_id = l.id and a.titulo = t.titulo and a.estado = 'nueva'
        )
      )
      order by random()
      limit 1;
    end if;

    if v_linea_id is null then
      continue; -- no line has an available template
    end if;

    -- Weighted pick among templates not already active on this line.
    select t.* into v_plantilla
    from public.plantillas_alerta t
    where not exists (
      select 1 from public.alertas a
      where a.linea_id = v_linea_id and a.titulo = t.titulo and a.estado = 'nueva'
    )
    order by power(random(), 1.0 / t.peso) desc
    limit 1;

    if not found then
      continue; -- no template left that is not already active on this line
    end if;

    select e.id into v_estacion_id
    from public.estaciones e
    where e.linea_id = v_linea_id
      and e.numero = v_plantilla.estacion_numero;

    v_valor := round(
      (v_plantilla.valor_min + random() * (v_plantilla.valor_max - v_plantilla.valor_min))::numeric,
      2
    );

    insert into public.alertas (
      linea_id, estacion_id, severidad, titulo, valor, limite, unidad
    )
    values (
      v_linea_id, v_estacion_id, v_plantilla.severidad, v_plantilla.titulo,
      v_valor, v_plantilla.limite, v_plantilla.unidad
    )
    on conflict (linea_id, titulo) where estado = 'nueva' do nothing
    returning id into v_id;

    if v_id is null then
      continue; -- a concurrent caller already has this titulo active here
    end if;

    -- D25: a KPI-linked template records this alert's reading on the line's
    -- matching indicador (only for an alert that was actually inserted).
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

revoke execute on function public.demo_generar_alertas(uuid, int) from public, anon, authenticated;
grant execute on function public.demo_generar_alertas(uuid, int) to service_role;

-- Backfill for databases seeded before migration 015.
update public.plantillas_alerta
set indicador_clave = 'dph',
    valor_min = 4.5,
    valor_max = 6
where titulo = 'Defectos por hora en aumento'
  and indicador_clave is null;

insert into public.plantillas_alerta (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso, indicador_clave)
select v.severidad::public.severidad, v.titulo, v.estacion_numero, v.unidad, v.valor_min, v.valor_max, v.limite, v.peso, v.indicador_clave
from (values
  ('parar', 'FPY por debajo del objetivo', 4, '%', 82::numeric, 89.5::numeric, 90::numeric, 2, 'fpy'),
  ('atencion', 'Scrap por encima del objetivo', 3, '%', 2.1::numeric, 2.9::numeric, 2::numeric, 2, 'scrap')
) as v (severidad, titulo, estacion_numero, unidad, valor_min, valor_max, limite, peso, indicador_clave)
where exists (select 1 from public.plantillas_alerta)
  and not exists (select 1 from public.plantillas_alerta t where t.titulo = v.titulo);
