import "server-only"

import { readBackofficeToken } from "@/lib/api/backoffice-cookie"
import { isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
import { getFloorRepository } from "@/lib/floor-repository"

const NO_STORE = { "Cache-Control": "no-store" }
const UNAUTHORIZED = { error: "Sesión de back office inválida." }
const DISABLED = { error: "Back office deshabilitado: falta BACKOFFICE_KEY" }

/** POST /api/backoffice/reiniciar (G2): restores the floor to its seeded
 * state (see FloorRepository#reiniciarDemo). Same facilitator-cookie gate
 * as every other back-office route: fails closed with 503 when
 * BACKOFFICE_KEY is unset, 401 on a missing/invalid/stale session cookie. */
export async function POST(request: Request): Promise<Response> {
  if (!isBackofficeConfigured()) {
    return Response.json(DISABLED, { status: 503, headers: NO_STORE })
  }

  const token = readBackofficeToken(request)
  if (!isValidToken(token)) {
    return Response.json(UNAUTHORIZED, { status: 401, headers: NO_STORE })
  }

  await getFloorRepository().reiniciarDemo()
  return Response.json({ ok: true }, { headers: NO_STORE })
}
