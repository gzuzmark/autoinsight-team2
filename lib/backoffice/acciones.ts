"use client"

export type ResultadoAccion = { ok: true; data?: unknown } | { ok: false; error: string }

const ERROR_GENERICO = "No se pudo completar la acción."

/**
 * B1 (RDD review 2026-09-28): the shared, always-resolves (never throws)
 * fetch helper behind every back-office action button (Salir, Reiniciar
 * demo, Simular turno). The original "Salir" handler had a try/finally with
 * no catch, so a network error left the button disabled forever and threw
 * an unhandled rejection -- every caller of this function instead always
 * gets a `ResultadoAccion` it can use to clear its busy state and show an
 * inline message.
 */
export async function ejecutarAccion(input: string, init: RequestInit): Promise<ResultadoAccion> {
  try {
    const res = await fetch(input, init)
    if (res.ok) {
      // G6: some callers (e.g. "Simular turno") need the response body
      // (correo status) -- a 204/empty body parses to null, so this stays
      // `{ ok: true }` (no `data` key at all) for every caller that doesn't.
      const data = await res
        .clone()
        .json()
        .catch(() => null)
      return data === null ? { ok: true } : { ok: true, data }
    }

    const body = await res
      .clone()
      .json()
      .catch(() => null)
    const error = typeof body?.error === "string" ? body.error : ERROR_GENERICO
    return { ok: false, error }
  } catch {
    return { ok: false, error: ERROR_GENERICO }
  }
}
