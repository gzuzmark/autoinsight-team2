import "server-only"

import { readBackofficeToken } from "@/lib/api/backoffice-cookie"
import { isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
import { respuestaErrorInterno } from "@/lib/backoffice/route-error"
import { esEscenarioId, InvalidInputError, type EscenarioId } from "@/lib/domain/floor-repository"
import { getFloorRepository } from "@/lib/floor-repository"

const NO_STORE = { "Cache-Control": "no-store" }
const UNAUTHORIZED = { error: "Sesión de back office inválida." }
const DISABLED = { error: "Back office deshabilitado: falta BACKOFFICE_KEY" }
const INVALID_ESCENARIO = { error: "Escenario inválido." }

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

  try {
    await getFloorRepository().aplicarEscenario(escenario)
  } catch (err) {
    if (err instanceof InvalidInputError) {
      return Response.json(INVALID_ESCENARIO, { status: 400, headers: NO_STORE })
    }
    // D5: never an unhandled throw -- see lib/backoffice/route-error.ts.
    return respuestaErrorInterno("aplicarEscenario", err)
  }

  return Response.json({ ok: true }, { headers: NO_STORE })
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
