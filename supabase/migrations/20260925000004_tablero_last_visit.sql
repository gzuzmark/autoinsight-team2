-- H3 + H8 (Phase B'' hardening): public.tablero. Last-visit calculation now
-- accounts for a previous session that expired without ever being closed
-- via cerrar_sesion, and the active-alerts ordering uses an explicit
-- severity rank instead of relying on the enum's declaration order.
-- Replaces the function in full (`create or replace`, same signature).

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

  -- H3: last visit = the effective end of the user's most recent previous
  -- session (any session other than the current one): its `fin` when it was
  -- closed normally, or `inicio + duracion_sesion()` (clamped to `now()` so
  -- a still-open, unexpired concurrent session never reads as "in the
  -- future") when it expired without ever being closed. Null means first
  -- visit ever (no previous session at all).
  select max(coalesce(s.fin, least(s.inicio + private.duracion_sesion(), now())))
    into v_ultima_visita
  from public.sesiones s
  where s.usuario_id = v_usuario_id
    and s.id <> p_sesion_id;

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
        -- H8: explicit severity rank instead of relying on the enum's
        -- declaration order (parar < atencion < ok, see migration 1's
        -- comment); same result, but robust even if public.severidad is
        -- ever reordered or extended. This test is unchanged by the switch.
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
