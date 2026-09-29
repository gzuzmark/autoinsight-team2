import "server-only"

import type { LineaDemoConocida } from "@/lib/domain/floor-repository"
import type { Alerta } from "@/lib/mock-data"
import { construirPayloadAlerta } from "@/lib/push/payload"
import { PushSubscriptionGoneError, type PushSender } from "@/lib/push/sender"
import type { PushSubscriptionStore } from "@/lib/push/subscription-store"
import { endpointServicioPermitido } from "@/lib/push/validate-subscription"
import { enviarPushConLimite } from "@/lib/push/with-timeout"

export type ResultadoNotificacion = { notificadas: number; suscripcionesEliminadas: number }

/**
 * G7b: fans a push out to every stored office subscription, one per new
 * ALTA (severidad "parar") alert -- everything else in `alertas` is
 * ignored (the brief scopes push to ALTA only). Bounded and never throws:
 * a push failure must not fail the caller (a shift/scenario that already
 * committed, or the back-office "Disparar push" action reporting its own
 * result separately) -- individual send failures are swallowed; a 404/410
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
): Promise<ResultadoNotificacion> {
  const altas = alertas.filter((a) => a.severidad === "parar")
  if (altas.length === 0) return { notificadas: 0, suscripcionesEliminadas: 0 }

  let suscripciones: Awaited<ReturnType<PushSubscriptionStore["listar"]>>
  try {
    suscripciones = await store.listar()
  } catch (err) {
    console.error("[push] listar suscripciones failed:", err)
    return { notificadas: 0, suscripcionesEliminadas: 0 }
  }
  if (suscripciones.length === 0) return { notificadas: 0, suscripcionesEliminadas: 0 }

  let notificadas = 0
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
  if (suscripcionesValidas.length === 0) return { notificadas: 0, suscripcionesEliminadas }

  for (const alerta of altas) {
    const payload = construirPayloadAlerta(linea, alerta)
    for (const subscripcion of suscripcionesValidas) {
      try {
        await enviarPushConLimite(sender, subscripcion, payload)
        notificadas++
      } catch (err) {
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
    }
  }

  return { notificadas, suscripcionesEliminadas }
}
