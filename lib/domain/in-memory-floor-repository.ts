import { randomUUID } from "node:crypto"
import { activeAlerts, attendAlert, dismissAlert, mergeShiftAlerts } from "@/lib/domain/alerts"
import { indicadorATablero, recuperarIndicador } from "@/lib/domain/indicadores"
import type {
  FloorRepository,
  IndicadorTablero,
  Resolucion,
  Tablero,
  UsuarioLogin,
} from "@/lib/domain/floor-repository"
import { AlertNotFoundError, InvalidInputError, SessionInvalidError } from "@/lib/domain/floor-repository"
import {
  ALERTAS_INICIALES,
  ALERTAS_NUEVO_TURNO,
  INDICADORES,
  ordenarAlertas,
  PLANTA_NOMBRE,
  USUARIOS,
  type Alerta,
  type Indicador,
} from "@/lib/mock-data"

const LINEA = { nombre: "Línea 3 · Motores", turno: "Turno mañana" }

type Sesion = {
  usuarioId: string
  /** Snapshot of the user's last-visit timestamp, fixed for the lifetime of
   * this session (mirrors the previous `ultimoLogoutTs` ref: it must not
   * change while the session that will become "the last visit" is itself
   * still open). */
  ultimaVisita: number | null
}

/**
 * Mock-mode adapter (D19): reproduces the app's pre-Phase-C behavior exactly
 * -- same users/PINs, same seed alerts, same shift-simulation alerts, same
 * since-last-visit derivation -- without a real backend, so existing tests,
 * `test:ui` and demos keep working with no server configured.
 *
 * State is process-memory only (module-level singleton via
 * `getFloorRepository()`); it does not survive a server restart and is not
 * shared across serverless instances, same limitation as the login-attempt
 * throttle documented in the README.
 */
export class InMemoryFloorRepository implements FloorRepository {
  private alertas: Alerta[] = ordenarAlertas(ALERTAS_INICIALES)
  /** D24/D26 mock parity: readings are mutable state, mirroring
   * `indicadores` in the Supabase adapter. Cloned from the module-level
   * fixture so each repository instance (each test, each dev server
   * restart) starts from the same baseline instead of sharing mutations. */
  private indicadoresState: Indicador[] = INDICADORES.map((i) => ({ ...i }))
  private ultimaActualizacion = Date.now()
  private readonly sesiones = new Map<string, Sesion>()
  /** Epoch ms of each user's most recent closed session (their "last
   * visit"), keyed by user id. Absent = never logged out before. */
  private readonly ultimaVisitaPorUsuario = new Map<string, number>()

  async usuariosLogin(): Promise<UsuarioLogin[]> {
    return USUARIOS.map(({ id, nombre, iniciales, color }) => ({ id, nombre, iniciales, color }))
  }

  async iniciarSesion(usuarioId: string, pin: string): Promise<string | null> {
    const usuario = USUARIOS.find((u) => u.id === usuarioId)
    if (!usuario || usuario.pin !== pin) return null

    const sessionId = randomUUID()
    this.sesiones.set(sessionId, {
      usuarioId,
      ultimaVisita: this.ultimaVisitaPorUsuario.get(usuarioId) ?? null,
    })
    return sessionId
  }

  async cerrarSesion(sessionId: string): Promise<void> {
    const sesion = this.sesiones.get(sessionId)
    if (!sesion) return
    this.ultimaVisitaPorUsuario.set(sesion.usuarioId, Date.now())
    this.sesiones.delete(sessionId)
  }

  async tablero(sessionId: string): Promise<Tablero> {
    const sesion = this.requireSesion(sessionId)
    const usuario = USUARIOS.find((u) => u.id === sesion.usuarioId)!
    const activas = activeAlerts(this.alertas)

    return {
      planta: { nombre: PLANTA_NOMBRE },
      linea: LINEA,
      usuario: { id: usuario.id, nombre: usuario.nombre, iniciales: usuario.iniciales, color: usuario.color },
      indicadores: this.indicadores(),
      alertas: activas,
      ultimaActualizacion: this.ultimaActualizacion,
      ultimaVisita: sesion.ultimaVisita,
      nuevasIds: this.nuevasIdsDesde(activas, sesion.ultimaVisita),
      cambiosDesdeVisita: this.cambiosDesdeVisita(sesion.ultimaVisita),
    }
  }

  async resolverAlerta(sessionId: string, alertaId: string, resolucion: Resolucion): Promise<void> {
    this.requireSesion(sessionId)

    if (resolucion !== "atendida" && resolucion !== "no_aplica") {
      throw new InvalidInputError("Resolución inválida.")
    }
    if (!this.alertas.some((a) => a.id === alertaId)) {
      throw new AlertNotFoundError("Alerta no encontrada.")
    }

    this.alertas =
      resolucion === "atendida" ? attendAlert(this.alertas, alertaId) : dismissAlert(this.alertas, alertaId)
    this.ultimaActualizacion = Date.now()
  }

  async simular(sessionId: string): Promise<Tablero> {
    this.requireSesion(sessionId)

    const { alerts, added } = mergeShiftAlerts(this.alertas, ALERTAS_NUEVO_TURNO, Date.now())
    this.alertas = alerts
    if (added.length > 0) {
      this.ultimaActualizacion = Date.now()
      // D25/D26: none of the fixed ALERTAS_NUEVO_TURNO carries a KPI link
      // today (mirroring the fact that none of their titles match a
      // plantillas_alerta row with an indicador_clave in supabase/seed.sql),
      // so every indicator gets a recovery reading -- same rule the
      // Supabase adapter's demo_simular_turno applies when a shift adds
      // alerts: KPIs that did NOT get a new bad reading move one state
      // toward ok. Resolving an alert never reaches this method at all.
      this.aplicarRecuperacion([])
    }

    return this.tablero(sessionId)
  }

  /** D26: moves every indicator NOT in `clavesExcluidas` one state toward
   * ok. Extracted so a future KPI-linked shift alert can pass the hit
   * claves in without touching this loop. */
  private aplicarRecuperacion(clavesExcluidas: readonly string[]): void {
    const ahora = Date.now()
    this.indicadoresState = this.indicadoresState.map((ind) =>
      clavesExcluidas.includes(ind.id) ? ind : recuperarIndicador(ind, ahora),
    )
  }

  private requireSesion(sessionId: string): Sesion {
    const sesion = this.sesiones.get(sessionId)
    if (!sesion) throw new SessionInvalidError("Sesión inválida.")
    return sesion
  }

  private indicadores(): IndicadorTablero[] {
    return this.indicadoresState.map(indicadorATablero)
  }

  /** Currently-active alerts created after `ultimaVisita` (mirrors the
   * Supabase RPC's `nuevas_ids`: time-based, active-only). `ultimaVisita`
   * null means first visit: nothing to compare against. */
  private nuevasIdsDesde(activas: Alerta[], ultimaVisita: number | null): string[] {
    if (ultimaVisita === null) return []
    return activas.filter((a) => a.timestamp > ultimaVisita).map((a) => a.id)
  }

  /** K2: count of ALL alerts (any estado) created after `ultimaVisita`,
   * unlike `nuevasIdsDesde` which is active-only. 0 on first visit. */
  private cambiosDesdeVisita(ultimaVisita: number | null): number {
    if (ultimaVisita === null) return 0
    return this.alertas.filter((a) => a.timestamp > ultimaVisita).length
  }
}
