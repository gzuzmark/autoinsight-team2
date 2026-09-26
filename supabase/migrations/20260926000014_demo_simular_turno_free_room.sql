-- K5: "Simular turno" behaves like a shift change on a saturated line.
-- demo_generar_alertas only creates templates that are not already active on
-- the line, so after enough simulations every template is active and the
-- button generated nothing (staging Línea 3: 12 active, 0 available). Before
-- generating, close the line's OLDEST active alerts whose titulo belongs to a
-- template -- as no_aplica by the system (resuelta_por null), the same rule
-- demo_autoresolver uses -- until enough templates are free. Operator actions
-- (resolver_alerta) are unaffected; this is demo-only.

create or replace function public.demo_simular_turno(p_sesion_id uuid, p_cantidad int default 2)
returns setof public.alertas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linea_id uuid;
  v_disponibles int;
begin
  select linea_id into v_linea_id
  from private.validar_sesion(p_sesion_id);

  select count(*) into v_disponibles
  from public.plantillas_alerta t
  where not exists (
    select 1 from public.alertas a
    where a.linea_id = v_linea_id and a.titulo = t.titulo and a.estado = 'nueva'
  );

  if v_disponibles < greatest(p_cantidad, 0) then
    update public.alertas
    set estado = 'no_aplica',
        resuelta_en = now(),
        resuelta_por = null
    where id in (
      select a.id
      from public.alertas a
      where a.linea_id = v_linea_id
        and a.estado = 'nueva'
        and a.titulo in (select t.titulo from public.plantillas_alerta t)
      order by a.creada_en asc
      limit greatest(p_cantidad, 0) - v_disponibles
      for update skip locked
    );
  end if;

  return query select * from public.demo_generar_alertas(v_linea_id, p_cantidad);
end;
$$;

revoke execute on function public.demo_simular_turno(uuid, int) from public, anon, authenticated;
grant execute on function public.demo_simular_turno(uuid, int) to service_role;
