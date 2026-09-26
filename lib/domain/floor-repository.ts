import type { Alerta, Severidad } from "@/lib/mock-data"

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
}

export type Resolucion = "atendida" | "no_aplica"

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
  /** Simulates a shift change (adds new alerts) and returns the refreshed
   * tablero. @throws SessionInvalidError */
  simular(sessionId: string): Promise<Tablero>
}
