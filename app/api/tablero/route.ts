import "server-only"

import { SessionInvalidError } from "@/lib/domain/floor-repository"
import { getFloorRepository } from "@/lib/floor-repository"
import { readSessionId } from "@/lib/api/session-cookie"

const NO_STORE = { "Cache-Control": "no-store" }
const SESSION_INVALID_ERROR = { error: "Sesión inválida o expirada." }

export async function GET(request: Request): Promise<Response> {
  const sessionId = readSessionId(request)
  if (!sessionId) {
    return Response.json(SESSION_INVALID_ERROR, { status: 401, headers: NO_STORE })
  }

  try {
    const tablero = await getFloorRepository().tablero(sessionId)
    return Response.json(tablero, { headers: NO_STORE })
  } catch (err) {
    if (err instanceof SessionInvalidError) {
      return Response.json(SESSION_INVALID_ERROR, { status: 401, headers: NO_STORE })
    }
    throw err
  }
}
