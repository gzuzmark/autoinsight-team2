import "server-only"

import { readBackofficeToken } from "@/lib/api/backoffice-cookie"
import { isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
import { appBaseUrl, reportRecipients } from "@/lib/backoffice/reporte-config"
import { construirReporteEstadoActual } from "@/lib/backoffice/reporte-estado-actual"
import { getEmailSender } from "@/lib/email/get-email-sender"
import { getFloorRepository } from "@/lib/floor-repository"

const NO_STORE = { "Cache-Control": "no-store" }
const UNAUTHORIZED = { error: "Sesión de back office inválida." }
const DISABLED = { error: "Back office deshabilitado: falta BACKOFFICE_KEY" }
const SEND_FAILED = { ok: false, error: "No se pudo enviar el correo." }

/**
 * POST /api/backoffice/correo (G6, "Enviar correo ahora"): builds a
 * current-state snapshot across every known line and sends it right away
 * -- unlike `POST /api/backoffice/turno`'s shift report, this IS the
 * requested action, so a send failure is reported as a real error instead
 * of a 200 with an inline status. Same facilitator-cookie gate as every
 * other back-office route.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isBackofficeConfigured()) {
    return Response.json(DISABLED, { status: 503, headers: NO_STORE })
  }

  const token = readBackofficeToken(request)
  if (!isValidToken(token)) {
    return Response.json(UNAUTHORIZED, { status: 401, headers: NO_STORE })
  }

  const estado = await getFloorRepository().estadoDemo()
  const email = construirReporteEstadoActual({
    fecha: Date.now(),
    lineas: estado.lineas,
    appBaseUrl: appBaseUrl(),
  })

  try {
    await getEmailSender().send({ to: reportRecipients(), ...email })
  } catch {
    return Response.json(SEND_FAILED, { status: 502, headers: NO_STORE })
  }

  return Response.json({ ok: true }, { headers: NO_STORE })
}
