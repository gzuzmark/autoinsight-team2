import type { Alerta, EstadoAlerta, Severidad } from "@/lib/mock-data"
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
  /** Epoch ms of the last time this line's underlying data changed in the
   * DB. NOT what "Última actualización HH:MM" (D6) shows any more (Batch I,
   * final-demo plan 2026-09-29): the header now shows the client's own
   * last-successful-poll time instead (lib/domain/ultima-actualizacion-poll.ts),
   * since a line whose data never changes between two polls would
   * otherwise show a stale time despite the app polling it live. */
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

/** H3: open ("nueva") alert count per severity, keyed the same way KPI
 * states are ("parar"/"atencion"/"ok" -- rendered with the alert-vocabulary
 * words ALTA/MEDIA/BAJA via `SEVERIDAD_PALABRA`, D8). */
export type AlertasPorSeveridad = Record<Severidad, number>

/** Batch I (final-demo plan, 2026-09-29): one line's single KPI state, for
 * the back office's per-line KPI chips ("FPY ATENCIÓN · Defectos/h ATENCIÓN
 * · Scrap OK") -- independent of `LineaEstadoDemo#estadoKpi`'s worst-of
 * collapse, which still drives the single line-level chip. */
export type IndicadorEstadoDemo = { clave: string; estado: Severidad }

/** G2 back-office "Estado de la demo" card: one row per known line. */
export type LineaEstadoDemo = {
  nombre: LineaDemoConocida
  /**
   * H3: worst KPI state of the line -- the same computation the floor's own
   * KPI tiles use (worst of fpy/dph/scrap), NOT the worst open alert's
   * severity. Before H3 this field mapped the most severe open alert onto
   * the KPI words instead (ALTA -> PARAR), which mixes the D8 alert
   * vocabulary with the D10 KPI vocabulary and can disagree with the floor
   * tablet once a KPI recovers while its alert is still open (D26).
   */
  estadoKpi: Severidad
  /** Batch I: the line's own fpy/dph/scrap states, in that stable order,
   * for the per-line KPI chips (`demo_estado_lineas()`'s new `indicadores`
   * field). Empty in the D3 fallback placeholder (see `EstadoDemo#datosDisponibles`). */
  indicadores: IndicadorEstadoDemo[]
  /** H3: open alerts on the line, broken down by severity (D8 words via
   * `SEVERIDAD_PALABRA`) -- shown next to the KPI chip so the facilitator
   * still sees alert activity even though the chip itself is KPI-only. */
  alertasPorSeveridad: AlertasPorSeveridad
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
  /** G6: whether `simularTurno` should also send a shift-report email
   * (default true -- see `setEnviarReporteTurno`). Persisted so it survives
   * a page reload/server restart, same lifetime as `escenarioActivo`. */
  enviarReporteTurno: boolean
  /** D3 (final-demo plan Batch I, RDD review G3 follow-up
   * R3-fallback-reports-ok): true for every real adapter response. False
   * ONLY in the fallback placeholder `resolverEstadoDemo` builds when the
   * server-side `estadoDemo()` fetch itself failed -- the one signal the
   * dashboard needs to render an explicit "Sin datos" neutral state
   * instead of fabricating a healthy plant (never OK / never 0 alerts by
   * omission). */
  datosDisponibles: boolean
}

/** G6: KPI + still-open-alert snapshot needed to build the shift-report
 * email, returned by `simularTurno` so the caller never has to diff alert
 * lists itself to figure out "what did this shift generate". */
export type ReporteTurnoDatos = {
  linea: LineaDemoConocida
  /** Alerts generated by this specific shift (may be empty). */
  nuevasAlertas: Alerta[]
  /** KPI states on the line AFTER the shift. Empty when `datosDisponibles`
   * is false. */
  indicadores: IndicadorTablero[]
  /** Total open (active) alerts on the line after the shift. 0 when
   * `datosDisponibles` is false. */
  alertasAbiertas: number
  /** E1 (RDD review hotfix follow-up): the shift itself is always real by
   * the time this is returned -- the RPC/state mutation already committed.
   * `indicadores`/`alertasAbiertas` come from separate enrichment reads
   * that run AFTER that commit and exist only to build the shift-report
   * email; if any of them fails, the adapter degrades instead of throwing
   * (a committed shift must never turn into a 500), and sets this to
   * `false` so the caller (`POST /api/backoffice/turno`) reports the
   * email as `correo: "error"` instead of silently building a report from
   * empty/zeroed data. Always `true` in mock mode (`InMemoryFloorRepository`
   * derives this data locally -- it cannot fail this way). */
  datosDisponibles: boolean
}

/** G7b: real-data shape for the office alert-investigation screen
 * (`/oficina/alertas/[id]`). Unlike `Alerta` (floor-tablet shape, D5: no
 * numeric value), the office view is read at a desk and shows real
 * numbers (O-D4) -- `valor`/`limite`/`unidad` mirror the Supabase
 * `alertas` table's own columns directly (no separate indicator lookup
 * needed: the alert already carries the reading that triggered it).
 * `valor`/`limite`/`unidad` and `resueltaEn` are always null in mock mode
 * (`InMemoryFloorRepository`'s `Alerta` shape does not carry them) -- the
 * office screen must show this honestly (label the KPI-chart/8D sections
 * "Ejemplo" instead), never fabricate a number. */
export type AlertaDetalle = {
  id: string
  severidad: Severidad
  titulo: string
  linea: string
  estacion: string | null
  estado: EstadoAlerta
  valor: number | null
  limite: number | null
  unidad: string | null
  creadaEn: number
  resueltaEn: number | null
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
   *
   * G6: returns the data needed to build a shift-report email (new alerts,
   * post-shift KPI states, still-open alert count) instead of void, so the
   * caller (`POST /api/backoffice/turno`) never has to diff alert lists
   * itself.
   * @throws InvalidInputError if `linea` is not in LINEAS_DEMO_CONOCIDAS.
   */
  simularTurno(linea: LineaDemoConocida): Promise<ReporteTurnoDatos>

  /** G6: flips the "Enviar reporte al simular turno" toggle (back office
   * "Comunicaciones" card). Persisted -- see `EstadoDemo#enviarReporteTurno`. */
  setEnviarReporteTurno(valor: boolean): Promise<void>

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

  /** G7b: real alert data for the office investigation screen. Searches
   * every known line (no session/line context on `/oficina`). Returns null
   * for an unknown id -- callers that also serve the office's static
   * sample alerts (`lib/oficina/mock-data.ts`) fall back to those before
   * calling `notFound()`, never on a repository throw. */
  obtenerAlerta(id: string): Promise<AlertaDetalle | null>
}
