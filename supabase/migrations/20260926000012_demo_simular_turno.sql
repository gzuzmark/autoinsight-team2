-- K1: public.demo_simular_turno -- the "Simular turno" demo button (D23)
-- called demo_generar_alertas(p_cantidad: 2) with p_linea_id omitted, which
-- picks a random line PER ALERT, so the operator's own dashboard often
-- looked unchanged (the alerts landed on someone else's line). This RPC
-- validates the session (same 28000 contract as every other session-taking
-- RPC) and generates on the SESSION'S OWN line by delegating to
-- demo_generar_alertas with that line pinned, reusing its weighted
-- available-template pick and dedupe/conflict handling verbatim.

create function public.demo_simular_turno(p_sesion_id uuid, p_cantidad int default 2)
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

  return query select * from public.demo_generar_alertas(v_linea_id, p_cantidad);
end;
$$;

revoke execute on function public.demo_simular_turno(uuid, int) from public;
grant execute on function public.demo_simular_turno(uuid, int) to service_role;
