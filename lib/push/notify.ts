import "server-only"

import type { LineaDemoConocida } from "@/lib/domain/floor-repository"
import type { Alerta } from "@/lib/mock-data"
import { construirPayloadAlerta } from "@/lib/push/payload"
import { PushSubscriptionGoneError, type PushSender } from "@/lib/push/sender"
import type { PushSubscriptionStore } from "@/lib/push/subscription-store"
import { endpointServicioPermitido } from "@/lib/push/validate-subscription"
import { enviarPushConLimite } from "@/lib/push/with-timeout"

/**
 * I-1 (RDD review G7b follow-up, 2026-09-29): an honest delivery result --
 * `notificadas`/`suscripcionesEliminadas` alone could not tell a caller
 * apart "nothing to send" from "everything failed", which let
 * POST /api/backoffice/push report success (200) on a total failure. Now:
 *  - `intentadas`: how many (alert x valid subscription) sends were
 *    actually started (an allowlist-skip is never "attempted").
 *  - `entregadas`: how many of those succeeded.
 *  - `fallidas`: how many of those failed (Gone or any other error).
 *  - `suscripcionesEliminadas`: rows removed (Gone, or allowlist miss).
 *  - `listadoFallo`: true when `store.listar()` itself threw, so a caller
 *    can tell "no subscribers" apart from "could not even check".
 */
export type ResultadoNotificacion = {
  intentadas: number
  entregadas: number
  fallidas: number
  suscripcionesEliminadas: number
  listadoFallo: boolean
}

function resultadoVacio(listadoFallo = false): ResultadoNotificacion {
  return { intentadas: 0, entregadas: 0, fallidas: 0, suscripcionesEliminadas: 0, listadoFallo }
}

// I-2 (RDD review G7b follow-up, 2026-09-29): bounded concurrency for the
// send fan-out (was one send at a time -- with the 200-subscription cap and
// an 8s per-send timeout, that was a ~1600s worst case) and a hard total
// time budget for the whole fan-out, so a turno/escenario/"Disparar push"
// response is never held open by a slow or hung push service beyond this,
// regardless of how many subscriptions or ALTA alerts there are. Any job
// still in flight when the budget fires is abandoned (not counted, not
// awaited further) -- its own per-send timeout (enviarPushConLimite, 8s)
// still bounds the underlying request even though nothing here waits on it.
const CONCURRENCIA_MAXIMA = 10
const PRESUPUESTO_TOTAL_MS = 10_000

type OpcionesFanOut = { concurrenciaMaxima?: number; presupuestoTotalMs?: number }

/** Runs `trabajos` with at most `concurrencia` running at once, giving up
 * (without cancelling in-flight work) once `presupuestoMs` elapses. */
async function ejecutarFanOut(
  trabajos: Array<() => Promise<void>>,
  concurrencia: number,
  presupuestoMs: number,
): Promise<void> {
  if (trabajos.length === 0) return
  let indice = 0
  async function trabajador(): Promise<void> {
    while (indice < trabajos.length) {
      const actual = indice++
      await trabajos[actual]()
    }
  }
  const pool = Promise.all(Array.from({ length: Math.min(concurrencia, trabajos.length) }, () => trabajador()))

  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, presupuestoMs)
  })
  try {
    await Promise.race([pool, limite])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * G7b: fans a push out to every stored office subscription, one per new
 * ALTA (severidad "parar") alert -- everything else in `alertas` is
 * ignored (the brief scopes push to ALTA only). Bounded and never throws:
 * a push failure must not fail the caller (a shift/scenario that already
 * committed, or the back-office "Disparar push" action reporting its own
 * result separately) -- individual send failures are swallowed (but
 * counted, see `ResultadoNotificacion`); a 404/410
 * (`PushSubscriptionGoneError`) additionally deletes that subscription so
 * a dead endpoint is not retried forever.
 *
 * Defense in depth: `validarSuscripcion` already rejects a non-allowlisted
 * endpoint on write, but a row written before that hardening landed (or by
 * any other means) must not still be relayed to on every ALTA -- so every
 * stored subscription is re-checked against the same allowlist here, and
 * any that fails it is skipped and deleted instead of sent to.
 */
export async function notificarAlertasAlta(
  sender: PushSender,
  store: PushSubscriptionStore,
  linea: LineaDemoConocida,
  alertas: readonly Alerta[],
  opciones: OpcionesFanOut = {},
): Promise<ResultadoNotificacion> {
  const concurrenciaMaxima = opciones.concurrenciaMaxima ?? CONCURRENCIA_MAXIMA
  const presupuestoTotalMs = opciones.presupuestoTotalMs ?? PRESUPUESTO_TOTAL_MS

  const altas = alertas.filter((a) => a.severidad === "parar")
  if (altas.length === 0) return resultadoVacio()

  let suscripciones: Awaited<ReturnType<PushSubscriptionStore["listar"]>>
  try {
    suscripciones = await store.listar()
  } catch (err) {
    console.error("[push] listar suscripciones failed:", err)
    return resultadoVacio(true)
  }
  if (suscripciones.length === 0) return resultadoVacio()

  let suscripcionesEliminadas = 0

  const suscripcionesValidas: typeof suscripciones = []
  for (const subscripcion of suscripciones) {
    if (endpointServicioPermitido(subscripcion.endpoint)) {
      suscripcionesValidas.push(subscripcion)
      continue
    }
    try {
      await store.eliminar(subscripcion.endpoint)
      suscripcionesEliminadas++
    } catch (cleanupErr) {
      console.error("[push] eliminar suscripción no permitida failed:", cleanupErr)
    }
  }
  if (suscripcionesValidas.length === 0) return { ...resultadoVacio(), suscripcionesEliminadas }

  let intentadas = 0
  let entregadas = 0
  let fallidas = 0

  const trabajos: Array<() => Promise<void>> = []
  for (const alerta of altas) {
    const payload = construirPayloadAlerta(linea, alerta)
    for (const subscripcion of suscripcionesValidas) {
      trabajos.push(async () => {
        intentadas++
        try {
          await enviarPushConLimite(sender, subscripcion, payload)
          entregadas++
        } catch (err) {
          fallidas++
          if (err instanceof PushSubscriptionGoneError) {
            try {
              await store.eliminar(subscripcion.endpoint)
              suscripcionesEliminadas++
            } catch (cleanupErr) {
              console.error("[push] eliminar suscripción caducada failed:", cleanupErr)
            }
          } else {
            console.error("[push] send failed:", err)
          }
        }
      })
    }
  }

  await ejecutarFanOut(trabajos, concurrenciaMaxima, presupuestoTotalMs)

  return { intentadas, entregadas, fallidas, suscripcionesEliminadas, listadoFallo: false }
}
