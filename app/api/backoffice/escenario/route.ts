import "server-only"

import { readBackofficeToken } from "@/lib/api/backoffice-cookie"
import { isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
import { respuestaErrorInterno } from "@/lib/backoffice/route-error"
import { esEscenarioId, InvalidInputError, type EscenarioId } from "@/lib/domain/floor-repository"
import { getFloorRepository } from "@/lib/floor-repository"
import { getPushSender } from "@/lib/push/get-push-sender"
import { getPushSubscriptionStore } from "@/lib/push-subscription-store"
import { notificarAlertasAlta, type ResultadoNotificacion } from "@/lib/push/notify"

const NO_STORE = { "Cache-Control": "no-store" }
const UNAUTHORIZED = { error: "Sesión de back office inválida." }
const DISABLED = { error: "Back office deshabilitado: falta BACKOFFICE_KEY" }
const INVALID_ESCENARIO = { error: "Escenario inválido." }

/** I-1 (RDD review G7b follow-up, 2026-09-29): same shape/rationale as the
 * turno route's own `PushStatus` -- never fails this route's own
 * operation, but reports the push outcome honestly instead of always
 * silently swallowing it. */
type PushStatus = "enviado" | "sin_suscripciones" | "error" | "omitido"

function estadoPushDesdeResultado(resultado: ResultadoNotificacion): PushStatus {
  if (resultado.listadoFallo) return "error"
  if (resultado.intentadas === 0) return "sin_suscripciones"
  if (resultado.entregadas === 0) return "error"
  return "enviado"
}

/** POST /api/backoffice/escenario (G3): applies a predefined scenario (body
 * `{ escenario }`, validated against ESCENARIO_IDS -- see
 * FloorRepository#aplicarEscenario). Same facilitator-cookie gate as every
 * other back-office route. */
export async function POST(request: Request): Promise<Response> {
  if (!isBackofficeConfigured()) {
    return Response.json(DISABLED, { status: 503, headers: NO_STORE })
  }

  const token = readBackofficeToken(request)
  if (!isValidToken(token)) {
    return Response.json(UNAUTHORIZED, { status: 401, headers: NO_STORE })
  }

  const escenario = await parseEscenario(request)
  if (!escenario) {
    return Response.json(INVALID_ESCENARIO, { status: 400, headers: NO_STORE })
  }

  const repo = getFloorRepository()
  try {
    await repo.aplicarEscenario(escenario)
  } catch (err) {
    if (err instanceof InvalidInputError) {
      return Response.json(INVALID_ESCENARIO, { status: 400, headers: NO_STORE })
    }
    // D5: never an unhandled throw -- see lib/backoffice/route-error.ts.
    return respuestaErrorInterno("aplicarEscenario", err)
  }

  // G7b: a scenario is deterministic (lib/domain/escenarios.ts) -- only
  // "linea3-parar-alta" ever produces an open ALTA alert, so the new-alert
  // list this route pushes for is exactly that one alert when it is the
  // scenario just applied. Bounded/never-throwing, same rationale as the
  // turno route's own push trigger; I-1 (RDD review G7b follow-up,
  // 2026-09-29) reports the outcome instead of always swallowing it.
  const push = await notificarAlertasAltaParaEscenario(repo)

  return Response.json({ ok: true, push }, { headers: NO_STORE })
}

async function notificarAlertasAltaParaEscenario(repo: ReturnType<typeof getFloorRepository>): Promise<PushStatus> {
  let encontrada
  try {
    encontrada = await repo.alertaAltaMasReciente()
  } catch (err) {
    console.error("[push] alertaAltaMasReciente (escenario) failed:", err)
    return "error"
  }
  if (!encontrada) return "omitido"
  try {
    const resultado = await notificarAlertasAlta(getPushSender(), getPushSubscriptionStore(), encontrada.linea, [
      encontrada.alerta,
    ])
    return estadoPushDesdeResultado(resultado)
  } catch (err) {
    console.error("[push] notificarAlertasAlta (escenario) failed:", err)
    return "error"
  }
}

async function parseEscenario(request: Request): Promise<EscenarioId | null> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return null
  }
  if (typeof json !== "object" || json === null) return null
  const value = (json as Record<string, unknown>).escenario
  return esEscenarioId(value) ? value : null
}
