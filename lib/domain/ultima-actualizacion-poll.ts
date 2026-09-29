/**
 * Batch I (final-demo plan, 2026-09-29): "Última actualización HH:MM" (D6)
 * must show the time of the last SUCCESSFUL poll of `/api/tablero`
 * (client-side liveness, D29), not `Tablero#ultimaActualizacion` (the DB's
 * `ultima_actualizacion`, which only changes when the underlying data
 * changes -- a line that never mutates during a poll interval would show a
 * stale time even though the app is polling it live and reachable).
 *
 * Pure, unit-tested state mirroring the same shallow-reducer pattern as
 * `lib/domain/nuevas-alertas-poll.ts`: `AppProvider` calls
 * `registrarPollExitoso` from the same `aplicarTablero` helper that already
 * centralizes every successful tablero fetch (login, 15s poll tick, and a
 * resolve-triggered refresh), so this stays in sync with those without any
 * of them having to remember it individually.
 */
export type EstadoUltimaActualizacion = {
  /** Epoch ms of the last successful tablero fetch this session, or null
   * before the first one has landed. */
  ultimoPollExitoso: number | null
}

export const ESTADO_INICIAL_ULTIMA_ACTUALIZACION: EstadoUltimaActualizacion = { ultimoPollExitoso: null }

/** Feed one successful fetch's timestamp in. Pure: returns a new state,
 * never mutates `estado`. */
export function registrarPollExitoso(
  estado: EstadoUltimaActualizacion,
  ahora: number,
): EstadoUltimaActualizacion {
  return { ultimoPollExitoso: ahora }
}
