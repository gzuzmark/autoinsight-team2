import "server-only"

import { SessionInvalidError } from "@/lib/domain/floor-repository"
import { getFloorRepository } from "@/lib/floor-repository"
import { readSessionId } from "@/lib/api/session-cookie"

const NO_STORE = { "Cache-Control": "no-store" }
const SESSION_INVALID_ERROR = { error: "Sesión inválida o expirada." }

/** POST /api/demo/simular (D23): only reachable when DEMO_ENABLED=true --
 * everywhere else it 404s, indistinguishable from a route that does not
 * exist, so the demo surface is invisible unless explicitly turned on. */
export async function POST(request: Request): Promise<Response> {
  if (process.env.DEMO_ENABLED !== "true") {
    return new Response(null, { status: 404, headers: NO_STORE })
  }

  const sessionId = readSessionId(request)
  if (!sessionId) {
    return Response.json(SESSION_INVALID_ERROR, { status: 401, headers: NO_STORE })
  }

  try {
    const tablero = await getFloorRepository().simular(sessionId)
    return Response.json(tablero, { headers: NO_STORE })
  } catch (err) {
    if (err instanceof SessionInvalidError) {
      return Response.json(SESSION_INVALID_ERROR, { status: 401, headers: NO_STORE })
    }
    throw err
  }
}
