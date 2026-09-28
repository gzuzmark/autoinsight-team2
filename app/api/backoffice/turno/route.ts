import "server-only"

import { readBackofficeToken } from "@/lib/api/backoffice-cookie"
import { isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
import { esLineaDemoConocida, InvalidInputError, type LineaDemoConocida } from "@/lib/domain/floor-repository"
import { getFloorRepository } from "@/lib/floor-repository"

const NO_STORE = { "Cache-Control": "no-store" }
const UNAUTHORIZED = { error: "Sesión de back office inválida." }
const DISABLED = { error: "Back office deshabilitado: falta BACKOFFICE_KEY" }
const INVALID_LINEA = { error: "Línea inválida." }

/** POST /api/backoffice/turno (G2): simulates a shift change on one line
 * (body `{ linea }`, validated against LINEAS_DEMO_CONOCIDAS -- see
 * FloorRepository#simularTurno). Same facilitator-cookie gate as every
 * other back-office route. */
export async function POST(request: Request): Promise<Response> {
  if (!isBackofficeConfigured()) {
    return Response.json(DISABLED, { status: 503, headers: NO_STORE })
  }

  const token = readBackofficeToken(request)
  if (!isValidToken(token)) {
    return Response.json(UNAUTHORIZED, { status: 401, headers: NO_STORE })
  }

  const linea = await parseLinea(request)
  if (!linea) {
    return Response.json(INVALID_LINEA, { status: 400, headers: NO_STORE })
  }

  try {
    await getFloorRepository().simularTurno(linea)
  } catch (err) {
    if (err instanceof InvalidInputError) {
      return Response.json(INVALID_LINEA, { status: 400, headers: NO_STORE })
    }
    throw err
  }

  return Response.json({ ok: true }, { headers: NO_STORE })
}

async function parseLinea(request: Request): Promise<LineaDemoConocida | null> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return null
  }
  if (typeof json !== "object" || json === null) return null
  const value = (json as Record<string, unknown>).linea
  return esLineaDemoConocida(value) ? value : null
}
