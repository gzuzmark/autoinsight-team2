import "server-only"

import { AlertNotFoundError, InvalidInputError, SessionInvalidError } from "@/lib/domain/floor-repository"
import { getFloorRepository } from "@/lib/floor-repository"
import { readSessionId } from "@/lib/api/session-cookie"

const NO_STORE = { "Cache-Control": "no-store" }
const INVALID_RESOLUTION_ERROR = { error: "Resolución inválida." }
const SESSION_INVALID_ERROR = { error: "Sesión inválida o expirada." }
const ALERT_NOT_FOUND_ERROR = { error: "Alerta no encontrada." }

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const sessionId = readSessionId(request)
  if (!sessionId) {
    return Response.json(SESSION_INVALID_ERROR, { status: 401, headers: NO_STORE })
  }

  const resolucion = await parseResolucion(request)
  if (!resolucion) {
    return Response.json(INVALID_RESOLUTION_ERROR, { status: 400, headers: NO_STORE })
  }

  const { id } = await context.params
  const repo = getFloorRepository()

  try {
    await repo.resolverAlerta(sessionId, id, resolucion)
    const tablero = await repo.tablero(sessionId)
    return Response.json(tablero, { headers: NO_STORE })
  } catch (err) {
    if (err instanceof SessionInvalidError) {
      return Response.json(SESSION_INVALID_ERROR, { status: 401, headers: NO_STORE })
    }
    if (err instanceof AlertNotFoundError) {
      return Response.json(ALERT_NOT_FOUND_ERROR, { status: 404, headers: NO_STORE })
    }
    if (err instanceof InvalidInputError) {
      return Response.json(INVALID_RESOLUTION_ERROR, { status: 400, headers: NO_STORE })
    }
    throw err
  }
}

async function parseResolucion(request: Request): Promise<"atendida" | "no_aplica" | null> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return null
  }
  if (typeof json !== "object" || json === null) return null
  const value = (json as Record<string, unknown>).resolucion
  return value === "atendida" || value === "no_aplica" ? value : null
}
