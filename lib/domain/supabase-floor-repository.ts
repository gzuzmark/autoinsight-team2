import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type {
  EscenarioId,
  EstadoDemo,
  FloorRepository,
  IndicadorTablero,
  LineaDemoConocida,
  ReporteTurnoDatos,
  Resolucion,
  Tablero,
  UsuarioLogin,
} from "@/lib/domain/floor-repository"
import {
  AlertNotFoundError,
  esEscenarioId,
  esLineaDemoConocida,
  InvalidInputError,
  SessionInvalidError,
} from "@/lib/domain/floor-repository"
import type { Database } from "@/lib/supabase/database.types"
import type { Alerta, Severidad } from "@/lib/mock-data"

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
    return this.mapTablero(data as TableroRow)
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
    const [lineasResult, activoResult, reporteResult] = await Promise.all([
      this.client.rpc("demo_estado_lineas"),
      this.client.rpc("demo_estado_activo"),
      this.client.rpc("demo_enviar_reporte_turno"),
    ])
    if (lineasResult.error) throw this.mapError(lineasResult.error)
    if (activoResult.error) throw this.mapError(activoResult.error)
    if (reporteResult.error) throw this.mapError(reporteResult.error)

    const filas = (lineasResult.data ?? []) as EstadoLineaRow[]
    const activo = activoResult.data as string | null
    return {
      lineas: filas
        .filter((f): f is EstadoLineaRow & { nombre: LineaDemoConocida } => esLineaDemoConocida(f.nombre))
        .map((f) => ({
          nombre: f.nombre,
          estado: f.estado,
          alertasAbiertas: f.alertas_abiertas,
          ultimaSimulacion: f.ultima_simulacion ? new Date(f.ultima_simulacion).getTime() : null,
        })),
      // G3: an active scenario reported by a row this adapter does not know
      // (e.g. a stale/renamed id) degrades to null rather than throwing.
      escenarioActivo: esEscenarioId(activo) ? activo : null,
      // G6: reporteResult.data is boolean | null; null (should not happen --
      // the singleton row always has a value) degrades to the real default.
      enviarReporteTurno: reporteResult.data ?? true,
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

  async aplicarEscenario(id: EscenarioId): Promise<void> {
    if (!esEscenarioId(id)) {
      throw new InvalidInputError(`Escenario desconocido: ${id}`)
    }
    const { error } = await this.client.rpc("demo_aplicar_escenario", { p_escenario: id })
    if (error) throw this.mapError(error)
  }

  private mapTablero(row: TableroRow): Tablero {
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

/** Shape of one element of the jsonb array `public.demo_estado_lineas()`
 * returns (see the migration for the exact `row_to_json` shape this
 * mirrors). */
type EstadoLineaRow = {
  nombre: string
  estado: Severidad
  alertas_abiertas: number
  ultima_simulacion: string | null
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
