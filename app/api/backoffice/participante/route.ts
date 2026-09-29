import "server-only"

import { readBackofficeToken } from "@/lib/api/backoffice-cookie"
import { isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
import { respuestaErrorInterno } from "@/lib/backoffice/route-error"
import { getFloorRepository } from "@/lib/floor-repository"

const NO_STORE = { "Cache-Control": "no-store" }
const UNAUTHORIZED = { error: "Sesión de back office inválida." }
const DISABLED = { error: "Back office deshabilitado: falta BACKOFFICE_KEY" }

/** POST /api/backoffice/participante (G8): resets the demo (same effect as
 * POST /api/backoffice/reiniciar, see FloorRepository#nuevoParticipante)
 * and advances the "Participante actual" counter -- "Nuevo participante"
 * in the "Estado de la demo" card. Same facilitator-cookie gate as every
 * other back-office route. */
export async function POST(request: Request): Promise<Response> {
  if (!isBackofficeConfigured()) {
    return Response.json(DISABLED, { status: 503, headers: NO_STORE })
  }

  const token = readBackofficeToken(request)
  if (!isValidToken(token)) {
    return Response.json(UNAUTHORIZED, { status: 401, headers: NO_STORE })
  }

  let participante: number
  try {
    participante = await getFloorRepository().nuevoParticipante()
  } catch (err) {
    // D5: never an unhandled throw -- see lib/backoffice/route-error.ts.
    return respuestaErrorInterno("nuevoParticipante", err)
  }
  return Response.json({ ok: true, participante }, { headers: NO_STORE })
}
