-- K2: public.tablero gains 'cambios_desde_visita': the count of ALL alerts
-- on the line created after ultima_visita, regardless of estado. Unlike
-- 'nuevas_ids' (currently-active alerts only), this stays accurate once a
-- new alert is resolved and therefore drops out of the active list -- fixes
-- an F1 regression where, after every new-since-visit alert was resolved,
-- the client had no way to tell "nothing ever changed" (0) apart from
-- "something changed but it is all resolved now" (the since-last-visit
-- strip wrongly showed "Sin cambios" in the second case). Replaces the
-- function in full (`create or replace`, same signature as migration 9),
-- adding one key alongside the existing ones.

create or replace function public.tablero(p_sesion_id uuid)
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

  -- Last visit = the effective end of the user's most recent previous
  -- session that is either CLOSED (fin not null) or EXPIRED (inicio +
  -- duracion_sesion() <= now()); an open, unexpired parallel session (e.g.
  -- another device/tab still logged in) does not count as a visit at all
  -- (J1). Null means first visit ever, or every other session is still
  -- open and unexpired.
  select max(coalesce(s.fin, s.inicio + private.duracion_sesion()))
    into v_ultima_visita
  from public.sesiones s
  where s.usuario_id = v_usuario_id
    and s.id <> p_sesion_id
    and (s.fin is not null or s.inicio + private.duracion_sesion() <= now());

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
        order by
          case a.severidad
            when 'parar' then 0
            when 'atencion' then 1
            when 'ok' then 2
          end,
          a.creada_en desc
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
    -- K2: any estado, unlike nuevas_ids above.
    'cambios_desde_visita', (
      select count(*)::int
      from public.alertas a
      where a.linea_id = v_linea_id
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
