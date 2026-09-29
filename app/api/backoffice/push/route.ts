import "server-only"

import { readBackofficeToken } from "@/lib/api/backoffice-cookie"
import { isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
import { respuestaErrorInterno } from "@/lib/backoffice/route-error"
import { getFloorRepository } from "@/lib/floor-repository"
import { getPushSender } from "@/lib/push/get-push-sender"
import { getPushSubscriptionStore } from "@/lib/push-subscription-store"
import { notificarAlertasAlta } from "@/lib/push/notify"

const NO_STORE = { "Cache-Control": "no-store" }
const UNAUTHORIZED = { error: "Sesión de back office inválida." }
const DISABLED = { error: "Back office deshabilitado: falta BACKOFFICE_KEY" }
const SIN_ALERTA = { error: "No hay ninguna alerta ALTA abierta para notificar." }

/**
 * POST /api/backoffice/push ("Disparar push", G7b): sends a push for the
 * most recent open ALTA alert (`FloorRepository#alertaAltaMasReciente`) to
 * every stored office subscription. Same facilitator-cookie gate as every
 * other back-office route.
 *
 * Unlike the automatic triggers in the turno/escenario routes (which never
 * fail their own operation on a push failure -- the shift/scenario already
 * happened), this IS the operation: a total failure to notify is a real
 * error (502), same "on-demand send is a real error" rationale as
 * `POST /api/backoffice/correo` (G6).
 */
export async function POST(request: Request): Promise<Response> {
  if (!isBackofficeConfigured()) {
    return Response.json(DISABLED, { status: 503, headers: NO_STORE })
  }

  const token = readBackofficeToken(request)
  if (!isValidToken(token)) {
    return Response.json(UNAUTHORIZED, { status: 401, headers: NO_STORE })
  }

  const repo = getFloorRepository()
  let encontrada
  try {
    encontrada = await repo.alertaAltaMasReciente()
  } catch (err) {
    return respuestaErrorInterno("alertaAltaMasReciente", err)
  }
  if (!encontrada) {
    return Response.json(SIN_ALERTA, { status: 404, headers: NO_STORE })
  }

  let resultado
  try {
    const store = getPushSubscriptionStore()
    const suscripciones = await store.listar()
    if (suscripciones.length === 0) {
      return Response.json({ ok: true, notificadas: 0 }, { headers: NO_STORE })
    }
    resultado = await notificarAlertasAlta(getPushSender(), store, encontrada.linea, [encontrada.alerta])
  } catch (err) {
    return respuestaErrorInterno("notificarAlertasAlta", err)
  }

  return Response.json({ ok: true, notificadas: resultado.notificadas }, { headers: NO_STORE })
}
