import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type {
  AlertaDetalle,
  EscenarioId,
  EstadoDemo,
  FloorRepository,
  IndicadorTablero,
  LineaDemoConocida,
  NotificacionAlerta,
  ReporteTurnoDatos,
  Resolucion,
  Tablero,
  UsuarioLogin,
} from "@/lib/domain/floor-repository"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
import {
  AlertNotFoundError,
  esEscenarioId,
  esLineaDemoConocida,
  InvalidInputError,
  NOTIFICACIONES_LIMITE,
  SessionInvalidError,
} from "@/lib/domain/floor-repository"
import type { Database } from "@/lib/supabase/database.types"
import type { Alerta, EstadoAlerta, Severidad } from "@/lib/mock-data"

/**
 * Real-backend adapter (D19/D20): calls the SECURITY DEFINER RPCs in
 * `supabase/migrations/*` with the service-role key. Never used from the
 * browser -- `import "server-only"` makes any accidental client-side import
 * fail the build instead of shipping the secret key.
 *
 * Error mapping (see the RPC comments in
 * `supabase/migrations/20260925000002_floor_functions.sql`):
 *   - Postgres errcode 28000 (invalid_authorization_specification) ->
 *     SessionInvalidError (raised by `private.validar_sesion` for any
 *     unknown/expired session).
 *   - Postgres errcode P0002 (no_data_found, used deliberately here for
 *     "not found") -> AlertNotFoundError.
 *   - Postgres errcode 22023 (invalid_parameter_value) -> InvalidInputError.
 */
export class SupabaseFloorRepository implements FloorRepository {
  private readonly client: SupabaseClient<Database>

  constructor(url: string, secretKey: string) {
    this.client = createClient<Database>(url, secretKey, {
      auth: { persistSession: false },
    })
  }

  async usuariosLogin(): Promise<UsuarioLogin[]> {
    const { data, error } = await this.client.rpc("usuarios_login")
    if (error) throw this.mapError(error)
    return (data ?? []).map((u) => ({ id: u.id, nombre: u.nombre, iniciales: u.iniciales, color: u.color }))
  }

  async iniciarSesion(usuarioId: string, pin: string): Promise<string | null> {
    const { data, error } = await this.client.rpc("iniciar_sesion", {
      p_usuario_id: usuarioId,
      p_pin: pin,
    })
    if (error) throw this.mapError(error)
    return data ?? null
  }

  async cerrarSesion(sessionId: string): Promise<void> {
    const { error } = await this.client.rpc("cerrar_sesion", { p_sesion_id: sessionId })
    if (error) throw this.mapError(error)
  }

  async tablero(sessionId: string): Promise<Tablero> {
    const { data, error } = await this.client.rpc("tablero", { p_sesion_id: sessionId })
    if (error) throw this.mapError(error)

    // G8: the participant number is read from the same demo_configuracion
    // singleton estadoDemo() reads, via a second small RPC -- session
    // validity was already confirmed by the tablero() RPC above, so this
    // read cannot itself throw SessionInvalidError; a failure here degrades
    // to 1 (the column's own default) rather than failing the whole
    // tablero fetch over an identify-only field.
    let participante = 1
    const { data: participanteData, error: participanteError } = await this.client.rpc("demo_participante_actual")
    if (!participanteError && typeof participanteData === "number") {
      participante = participanteData
    }

    return this.mapTablero(data as TableroRow, participante)
  }

  async resolverAlerta(sessionId: string, alertaId: string, resolucion: Resolucion): Promise<void> {
    const { error } = await this.client.rpc("resolver_alerta", {
      p_sesion_id: sessionId,
      p_alerta_id: alertaId,
      p_resolucion: resolucion,
    })
    if (error) throw this.mapError(error)
  }

  async estadoDemo(): Promise<EstadoDemo> {
    const [lineasResult, activoResult, reporteResult, participanteResult] = await Promise.all([
      this.client.rpc("demo_estado_lineas"),
      this.client.rpc("demo_estado_activo"),
      this.client.rpc("demo_enviar_reporte_turno"),
      this.client.rpc("demo_participante_actual"),
    ])
    if (lineasResult.error) throw this.mapError(lineasResult.error)
    if (activoResult.error) throw this.mapError(activoResult.error)
    if (reporteResult.error) throw this.mapError(reporteResult.error)
    if (participanteResult.error) throw this.mapError(participanteResult.error)

    const filas = (lineasResult.data ?? []) as EstadoLineaRow[]
    const activo = activoResult.data as string | null
    return {
      lineas: filas
        .filter((f): f is EstadoLineaRow & { nombre: LineaDemoConocida } => esLineaDemoConocida(f.nombre))
        .map((f) => ({
          nombre: f.nombre,
          estadoKpi: f.estado_kpi,
          // Batch I: the RPC already returns fpy/dph/scrap in that stable
          // order (see the migration) -- passed through as-is.
          indicadores: f.indicadores ?? [],
          alertasPorSeveridad: { parar: f.alertas_alta, atencion: f.alertas_media, ok: f.alertas_baja },
          alertasAbiertas: f.alertas_abiertas,
          ultimaSimulacion: f.ultima_simulacion ? new Date(f.ultima_simulacion).getTime() : null,
        })),
      // G3: an active scenario reported by a row this adapter does not know
      // (e.g. a stale/renamed id) degrades to null rather than throwing.
      escenarioActivo: esEscenarioId(activo) ? activo : null,
      // G6: reporteResult.data is boolean | null; null (should not happen --
      // the singleton row always has a value) degrades to the real default.
      enviarReporteTurno: reporteResult.data ?? true,
      // G8: (participanteResult.data as number | null); null should not
      // happen (the column defaults to 1) -- a real fetch this far never
      // fabricates a fake participant number, so this stays whatever the
      // RPC returned (including a genuine null, unlike the boolean above).
      participanteActual: (participanteResult.data as number | null) ?? null,
      // Batch I: a real fetch that reached this point succeeded -- only the
      // D3 fallback (lib/backoffice/estado-demo-fallback.ts) ever reports
      // false.
      datosDisponibles: true,
    }
  }

  async setEnviarReporteTurno(valor: boolean): Promise<void> {
    const { error } = await this.client.rpc("demo_set_enviar_reporte_turno", { p_valor: valor })
    if (error) throw this.mapError(error)
  }

  async reiniciarDemo(): Promise<void> {
    const { error } = await this.client.rpc("demo_reiniciar")
    if (error) throw this.mapError(error)
  }

  async simularTurno(linea: LineaDemoConocida): Promise<ReporteTurnoDatos> {
    if (!esLineaDemoConocida(linea)) {
      throw new InvalidInputError(`Línea desconocida: ${linea}`)
    }
    const { data, error } = await this.client.rpc("demo_simular_turno_linea", { p_linea: linea, p_cantidad: 2 })
    if (error) throw this.mapError(error)

    const nuevasAlertas: Alerta[] = (data ?? []).map((a) => ({
      id: a.id,
      severidad: a.severidad,
      titulo: a.titulo,
      estacion: "",
      timestamp: new Date(a.creada_en).getTime(),
      estado: "nueva" as const,
    }))

    // G6: `demo_simular_turno_linea` already returns the newly-generated
    // alerts (`setof public.alertas`, see the migration) -- no separate
    // diff needed. KPI states after the shift and the still-open count come
    // from two more reads, done here rather than adding yet another RPC:
    // `public.indicadores` (unlike private.demo_configuracion) IS a public-
    // schema table, reachable directly with the service-role client.
    //
    // E1 (RDD review hotfix follow-up): the RPC above already committed the
    // shift -- it happened, for real, before this point. These enrichment
    // reads only build the shift-report email; a failure here must degrade
    // (`datosDisponibles: false`, empty/zeroed report fields) instead of
    // throwing, or a shift that succeeded would turn into a 500 for the
    // caller (see ReporteTurnoDatos#datosDisponibles's doc and POST
    // /api/backoffice/turno's own "the shift already happened" contract).
    try {
      const { data: lineaRow, error: lineaError } = await this.client
        .from("lineas")
        .select("id")
        .eq("nombre", linea)
        .single()
      if (lineaError) throw this.mapError(lineaError)

      const [{ data: indicadoresRows, error: indicadoresError }, { count: alertasAbiertas, error: countError }] =
        await Promise.all([
          this.client.from("indicadores").select("clave,nombre,detalle,estado").eq("linea_id", lineaRow.id),
          this.client
            .from("alertas")
            .select("id", { count: "exact", head: true })
            .eq("linea_id", lineaRow.id)
            .eq("estado", "nueva"),
        ])
      if (indicadoresError) throw this.mapError(indicadoresError)
      if (countError) throw this.mapError(countError)

      return {
        linea,
        nuevasAlertas,
        indicadores: (indicadoresRows ?? []).map(
          (i): IndicadorTablero => ({ id: i.clave, nombre: i.nombre, detalle: i.detalle, estado: i.estado }),
        ),
        alertasAbiertas: alertasAbiertas ?? 0,
        datosDisponibles: true,
      }
    } catch {
      return { linea, nuevasAlertas, indicadores: [], alertasAbiertas: 0, datosDisponibles: false }
    }
  }

  async nuevoParticipante(): Promise<number> {
    const { data, error } = await this.client.rpc("demo_nuevo_participante")
    if (error) throw this.mapError(error)
    return (data as number | null) ?? 1
  }

  async aplicarEscenario(id: EscenarioId): Promise<void> {
    if (!esEscenarioId(id)) {
      throw new InvalidInputError(`Escenario desconocido: ${id}`)
    }
    const { error } = await this.client.rpc("demo_aplicar_escenario", { p_escenario: id })
    if (error) throw this.mapError(error)
  }

  async obtenerAlerta(id: string): Promise<AlertaDetalle | null> {
    // G7b: office sample alert ids (lib/oficina/mock-data.ts, e.g.
    // "torque-fuera-de-rango-l3-e7") are never valid uuids -- querying
    // Postgres with one throws (invalid input syntax for type uuid) instead
    // of returning no rows. Short-circuit so the caller's sample-id
    // fallback works the same in both adapters.
    if (!UUID_RE.test(id)) return null

    // Direct table read (not an RPC): the service-role client already
    // bypasses RLS, and this is a plain by-id lookup with no state
    // mutation, so no SECURITY DEFINER function is needed for it.
    const { data, error } = await this.client
      .from("alertas")
      .select("id,severidad,titulo,estado,valor,limite,unidad,creada_en,resuelta_en,lineas(nombre),estaciones(nombre)")
      .eq("id", id)
      .maybeSingle()
    if (error) throw this.mapError(error)
    if (!data) return null
    const row = data as unknown as AlertaDetalleRow

    return {
      id: row.id,
      severidad: row.severidad,
      titulo: row.titulo,
      linea: row.lineas?.nombre ?? "",
      estacion: row.estaciones?.nombre ?? null,
      estado: row.estado,
      valor: row.valor,
      limite: row.limite,
      unidad: row.unidad,
      creadaEn: new Date(row.creada_en).getTime(),
      resueltaEn: row.resuelta_en ? new Date(row.resuelta_en).getTime() : null,
    }
  }

  async alertaAltaMasReciente(): Promise<{ linea: LineaDemoConocida; alerta: Alerta } | null> {
    const { data, error } = await this.client
      .from("alertas")
      .select("id,severidad,titulo,estacion_id,creada_en,lineas(nombre),estaciones(nombre)")
      .eq("severidad", "parar")
      .eq("estado", "nueva")
      .order("creada_en", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw this.mapError(error)
    if (!data) return null
    const row = data as unknown as {
      id: string
      severidad: Severidad
      titulo: string
      creada_en: string
      lineas: { nombre: string } | null
      estaciones: { nombre: string } | null
    }
    const linea = row.lineas?.nombre
    if (!esLineaDemoConocida(linea)) return null

    return {
      linea,
      alerta: {
        id: row.id,
        severidad: row.severidad,
        titulo: row.titulo,
        estacion: row.estaciones?.nombre ?? "",
        timestamp: new Date(row.creada_en).getTime(),
        estado: "nueva",
      },
    }
  }

  async alertasAltaRecientes(): Promise<NotificacionAlerta[]> {
    // G9: same direct-table-read approach as obtenerAlerta/alertaAltaMasReciente
    // above -- the service-role client already bypasses RLS, and this is a
    // read-only query, so no SECURITY DEFINER RPC is needed. "Open or
    // recent" (decided 2026-09-29): no `.eq("estado", "nueva")` filter,
    // unlike alertaAltaMasReciente -- an ALTA alert already resolved still
    // shows up here so the bell reflects what actually happened, not just
    // what is still open.
    const { data, error } = await this.client
      .from("alertas")
      .select("id,severidad,titulo,creada_en,lineas(nombre),estaciones(nombre)")
      .eq("severidad", "parar")
      .order("creada_en", { ascending: false })
      .limit(NOTIFICACIONES_LIMITE)
    if (error) throw this.mapError(error)
    const rows = (data ?? []) as unknown as {
      id: string
      severidad: Severidad
      titulo: string
      creada_en: string
      lineas: { nombre: string } | null
      estaciones: { nombre: string } | null
    }[]
    return rows.map((row) => ({
      id: row.id,
      titulo: row.titulo,
      severidad: row.severidad,
      linea: row.lineas?.nombre ?? "",
      estacion: row.estaciones?.nombre ?? null,
      creadaEn: new Date(row.creada_en).getTime(),
    }))
  }

  private mapTablero(row: TableroRow, participante: number): Tablero {
    return {
      planta: { nombre: row.planta.nombre },
      linea: { nombre: row.linea.nombre, turno: row.linea.turno },
      usuario: {
        id: row.usuario.id,
        nombre: row.usuario.nombre,
        iniciales: row.usuario.iniciales,
        color: row.usuario.color,
      },
      indicadores: row.indicadores.map((i) => ({
        id: i.clave,
        nombre: i.nombre,
        detalle: i.detalle,
        estado: i.estado,
      })),
      alertas: row.alertas.map((a): Alerta => ({
        id: a.id,
        severidad: a.severidad,
        titulo: a.titulo,
        estacion: a.estacion ?? "",
        timestamp: new Date(a.creada_en).getTime(),
        estado: "nueva",
      })),
      ultimaActualizacion: new Date(row.ultima_actualizacion).getTime(),
      ultimaVisita: row.ultima_visita ? new Date(row.ultima_visita).getTime() : null,
      participante,
      nuevasIds: row.nuevas_ids,
      cambiosDesdeVisita: row.cambios_desde_visita,
    }
  }

  private mapError(error: { code?: string; message: string }): Error {
    switch (error.code) {
      case "28000":
        return new SessionInvalidError("Sesión inválida.")
      case "P0002":
        return new AlertNotFoundError("Alerta no encontrada.")
      case "22023":
        return new InvalidInputError("Resolución inválida.")
      default:
        return new Error(error.message)
    }
  }
}

/** Shape of a `public.alertas` row joined to its `lineas`/`estaciones` name
 * (see `obtenerAlerta`'s select -- PostgREST embeds the related row under
 * the table name, singular relation). */
type AlertaDetalleRow = {
  id: string
  severidad: Severidad
  titulo: string
  estado: EstadoAlerta
  valor: number | null
  limite: number | null
  unidad: string | null
  creada_en: string
  resuelta_en: string | null
  lineas: { nombre: string } | null
  estaciones: { nombre: string } | null
}

/** Shape of one element of the jsonb array `public.demo_estado_lineas()`
 * returns (see the migration for the exact `row_to_json` shape this
 * mirrors). */
type EstadoLineaRow = {
  nombre: string
  /** H3: worst KPI state of the line (see LineaEstadoDemo#estadoKpi's doc). */
  estado_kpi: Severidad
  alertas_abiertas: number
  alertas_alta: number
  alertas_media: number
  alertas_baja: number
  ultima_simulacion: string | null
  /** Batch I: fpy/dph/scrap in that stable order (see
   * LineaEstadoDemo#indicadores's doc). */
  indicadores: Array<{ clave: string; estado: Severidad }>
}

/** Shape of the jsonb `public.tablero(uuid)` RPC result (see the migration
 * for the exact `jsonb_build_object` call this mirrors). */
type TableroRow = {
  planta: { nombre: string }
  linea: { nombre: string; turno: string }
  usuario: { id: string; nombre: string; iniciales: string; color: string }
  indicadores: Array<{
    clave: string
    nombre: string
    estado: Severidad
    detalle: string
    valor: number | null
    unidad: string | null
    actualizado_en: string
    desactualizado: boolean
  }>
  alertas: Array<{
    id: string
    severidad: Severidad
    titulo: string
    estacion: string | null
    valor: number | null
    limite: number | null
    unidad: string | null
    creada_en: string
  }>
  ultima_visita: string | null
  nuevas_ids: string[]
  cambios_desde_visita: number
  ultima_actualizacion: string
}
