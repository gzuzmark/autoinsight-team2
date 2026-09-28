import type { Alerta, Severidad } from "@/lib/mock-data"
import type { EscenarioId } from "@/lib/domain/escenarios"

export type { EscenarioId } from "@/lib/domain/escenarios"
export { ESCENARIO_IDS, ESCENARIOS, esEscenarioId } from "@/lib/domain/escenarios"

/**
 * Port for the plant-floor dashboard (D19-D23): every screen the app shows
 * is either derived from `tablero()` or a side effect of one of the other
 * methods. Pure types only -- no framework, no Next.js, no Supabase -- so
 * both `InMemoryFloorRepository` (mock mode) and `SupabaseFloorRepository`
 * (real backend) can implement it identically from the client's point of
 * view.
 */

/** Public, login-screen shape of a user: never carries the PIN (D19/T9: the
 * client must never know PINs; the server verifies them). */
export type UsuarioLogin = {
  id: string
  nombre: string
  iniciales: string
  color: string
}

export type Planta = { nombre: string }
export type Linea = { nombre: string; turno: string }

/** KPI tile data. Mirrors `lib/mock-data.ts`'s `Indicador` shape so
 * `IndicatorsRow` (which shows only name + state word + icon, D5) does not
 * need to change when its data starts coming from the API. */
export type IndicadorTablero = {
  id: string
  nombre: string
  detalle: string
  estado: Severidad
}

export type Tablero = {
  planta: Planta
  linea: Linea
  usuario: UsuarioLogin
  indicadores: IndicadorTablero[]
  /** Active alerts only ("nueva"), sorted (see lib/domain/alerts.ts). */
  alertas: Alerta[]
  /** Epoch ms; "Última actualización HH:MM" (D6) is derived from this. */
  ultimaActualizacion: number
  /** Epoch ms of the end of the user's previous session, or null on first
   * visit / no previous closed session (D9). */
  ultimaVisita: number | null
  /** Ids of currently-active alerts created after `ultimaVisita` (D9). */
  nuevasIds: string[]
  /** K2: count of ALL alerts on the line created after `ultimaVisita`,
   * regardless of `estado` (unlike `nuevasIds`, which only lists
   * currently-active ones). 0 on first visit (`ultimaVisita === null`).
   * Lets the client tell "nothing ever changed" (0) apart from "something
   * changed but every new alert has since been resolved" (> 0 with an empty
   * `nuevasIds` intersection against active alerts) -- see F1/K2. */
  cambiosDesdeVisita: number
}

export type Resolucion = "atendida" | "no_aplica"

/** G2: the fixed set of lines the facilitator back office can act on.
 * Matches supabase/seed.sql's `lineas.nombre` values exactly (both adapters
 * must agree on the same names -- the Supabase adapter resolves them by
 * exact-name lookup, mirroring `demo_simular_turno_linea`'s own contract). */
export const LINEAS_DEMO_CONOCIDAS = [
  "Línea 1 · Chasis",
  "Línea 2 · Pintura",
  "Línea 3 · Motores",
] as const

export type LineaDemoConocida = (typeof LINEAS_DEMO_CONOCIDAS)[number]

export function esLineaDemoConocida(valor: unknown): valor is LineaDemoConocida {
  return typeof valor === "string" && (LINEAS_DEMO_CONOCIDAS as readonly string[]).includes(valor)
}

/** G2 back-office "Estado de la demo" card: one row per known line. */
export type LineaEstadoDemo = {
  nombre: LineaDemoConocida
  /** Worst active-alert severity on the line, or "ok" when it has none. */
  estado: Severidad
  alertasAbiertas: number
  /** Epoch ms of the line's last "Simular turno", or null if never. */
  ultimaSimulacion: number | null
}

export type EstadoDemo = {
  lineas: LineaEstadoDemo[]
  /** G3: id of the scenario last applied via `aplicarEscenario`, or null
   * when none is active (never applied, or invalidated -- see
   * `aplicarEscenario`'s doc). */
  escenarioActivo: EscenarioId | null
}

/** No/expired/invalid session (maps from Postgres errcode 28000). */
export class SessionInvalidError extends Error {
  constructor(message = "Invalid session.") {
    super(message)
    this.name = "SessionInvalidError"
  }
}

/** Unknown alert id, or an alert that belongs to a different line than the
 * session's (maps from Postgres errcode P0002). */
export class AlertNotFoundError extends Error {
  constructor(message = "Alert not found.") {
    super(message)
    this.name = "AlertNotFoundError"
  }
}

/** Malformed input the caller controls (e.g. an invalid `resolucion` value;
 * maps from Postgres errcode 22023). */
export class InvalidInputError extends Error {
  constructor(message = "Invalid input.") {
    super(message)
    this.name = "InvalidInputError"
  }
}

export interface FloorRepository {
  /** Active users for the avatar grid. Never includes PIN data. */
  usuariosLogin(): Promise<UsuarioLogin[]>
  /** Verifies the PIN and opens a session. Returns null on ANY failure
   * (unknown user, wrong PIN, inactive user, locked out) -- the same shape
   * for every failure so callers cannot enumerate valid users. */
  iniciarSesion(usuarioId: string, pin: string): Promise<string | null>
  /** Idempotent: closing an unknown/already-closed session is a no-op. */
  cerrarSesion(sessionId: string): Promise<void>
  /** @throws SessionInvalidError */
  tablero(sessionId: string): Promise<Tablero>
  /**
   * @throws SessionInvalidError
   * @throws AlertNotFoundError
   * @throws InvalidInputError
   */
  resolverAlerta(sessionId: string, alertaId: string, resolucion: Resolucion): Promise<void>

  /** G2: facilitator back-office "Estado de la demo" card -- live per-line
   * state, independent of any session. Never requires a floor session. */
  estadoDemo(): Promise<EstadoDemo>
  /** G2: restores the floor to its seeded initial state (alerts, KPI
   * readings, per-line last-shift bookkeeping, "since last visit" state).
   * Users/PINs are never touched. Idempotent-in-effect: calling it again
   * from the just-reset state reproduces the same state. */
  reiniciarDemo(): Promise<void>
  /**
   * G2: simulates a shift change on one line (same rules as
   * `demo_simular_turno_linea`/the removed "Simular turno" button): frees
   * room on a saturated line, generates new alerts, records a KPI reading
   * for a linked template, then recovers every other indicator one step
   * toward ok.
   * @throws InvalidInputError if `linea` is not in LINEAS_DEMO_CONOCIDAS.
   */
  simularTurno(linea: LineaDemoConocida): Promise<void>

  /**
   * G3: resets to the seeded state, then applies a predefined scenario's
   * deterministic alerts/KPI readings, and records it as the active
   * scenario (`EstadoDemo#escenarioActivo`). A later `reiniciarDemo()`
   * clears the active scenario back to null (reset = "Estado inicial", no
   * scenario); a later `simularTurno()` also clears it (a shift makes the
   * scenario no longer exact).
   * @throws InvalidInputError if `id` is not in ESCENARIO_IDS.
   */
  aplicarEscenario(id: EscenarioId): Promise<void>
}
