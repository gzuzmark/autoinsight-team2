-- A shift excluded the KPIs hit by the alerts it just generated from the
-- D30 pass, so a new milder alert (e.g. "Vibración anómala", atencion) set
-- the KPI reading even while a more severe alert on the same KPI ("Torque
-- fuera de rango", parar) stayed open -> tile ATENCION with a PARAR problem
-- open (found on the staging project). Apply the most-severe rule to every
-- KPI after generating.

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
  -- just generated) is re-read from its MOST SEVERE open alert, so a new
  -- milder alert can never override a more severe open one; KPIs without
  -- open linked alerts recover one step (D26/D30).
  perform private.recuperar_indicadores(p_linea_id, '{}'::text[]);

  if v_alertas is not null then
    return query select * from unnest(v_alertas);
  end if;
end;
$$;

revoke execute on function private.simular_turno_en_linea(uuid, int) from public, anon, authenticated;
grant execute on function private.simular_turno_en_linea(uuid, int) to service_role, postgres;
