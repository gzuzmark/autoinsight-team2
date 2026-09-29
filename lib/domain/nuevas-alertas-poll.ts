import type { Alerta } from "@/lib/mock-data"

/**
 * G7a: pure state for the floor's "N alertas nuevas · HH:MM" inline strip.
 * D9's since-last-visit strip only covers the FIRST tablero fetch after
 * login; this covers every 15s poll (D29) AFTER that one -- an alert id
 * that appears in `activas` but was not present in any earlier poll this
 * session is "new" and gets added to the accumulating, dismissible batch.
 *
 * Session-scoped and reset-on-logout by construction: the caller (
 * AppProvider) simply replaces its state with `ESTADO_INICIAL` on `salir()`
 * / on a 401 during a poll, the same way it already resets `tablero`.
 */
export type EstadoNuevasAlertas = {
  /** Every alert id observed in any previous poll this session; `null`
   * before the first poll has landed (so that first poll can only learn
   * the baseline, never report "new" alerts -- D9 already covers it). */
  vistos: ReadonlySet<string> | null
  /** Alerts new since the strip was last dismissed (or since session
   * start), accumulated across polls until `descartarPendientes` runs. */
  pendientes: readonly Alerta[]
}

export const ESTADO_INICIAL_NUEVAS_ALERTAS: EstadoNuevasAlertas = { vistos: null, pendientes: [] }

/**
 * Feed one poll's active-alert list in. Pure: returns a new state, never
 * mutates `estado`.
 */
export function registrarPoll(estado: EstadoNuevasAlertas, activas: readonly Alerta[]): EstadoNuevasAlertas {
  const idsActuales = new Set(activas.map((a) => a.id))

  if (estado.vistos === null) {
    // First poll this session (including the initial post-login fetch):
    // just learn the baseline, report nothing as new.
    return { vistos: idsActuales, pendientes: estado.pendientes }
  }

  const vistosAnteriores = estado.vistos
  const nuevas = activas.filter((a) => !vistosAnteriores.has(a.id))
  // Union, never replace: an id that leaves the active list (resolved) and
  // later reappears (e.g. re-simulated) must stay "already known", not be
  // reported as new again.
  const vistosActualizados = new Set([...vistosAnteriores, ...idsActuales])
  if (nuevas.length === 0) {
    return { vistos: vistosActualizados, pendientes: estado.pendientes }
  }
  return { vistos: vistosActualizados, pendientes: [...estado.pendientes, ...nuevas] }
}

/** "Entendido" button: clears the accumulated batch. A later poll can start
 * accumulating a fresh one; `vistos` is untouched (still the full baseline). */
export function descartarPendientes(estado: EstadoNuevasAlertas): EstadoNuevasAlertas {
  if (estado.pendientes.length === 0) return estado
  return { ...estado, pendientes: [] }
}
