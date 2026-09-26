import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type {
  FloorRepository,
  Resolucion,
  Tablero,
  UsuarioLogin,
} from "@/lib/domain/floor-repository"
import { AlertNotFoundError, InvalidInputError, SessionInvalidError } from "@/lib/domain/floor-repository"
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
