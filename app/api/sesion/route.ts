import "server-only"

import { getFloorRepository } from "@/lib/floor-repository"
import { clientKey, shouldThrottle } from "@/lib/api/login-throttle"
import { clearedSessionCookieHeader, readSessionId, sessionCookieHeader } from "@/lib/api/session-cookie"

const NO_STORE = { "Cache-Control": "no-store" }
const GENERIC_LOGIN_ERROR = { error: "PIN incorrecto." }

/** POST /api/sesion: PIN login (D21). Every failure -- wrong PIN, unknown
 * user, malformed body, missing fields -- returns the exact same 401 body,
 * so a caller cannot enumerate valid users. */
export async function POST(request: Request): Promise<Response> {
  const key = clientKey(request)
  if (shouldThrottle(key)) {
    return Response.json(
      { error: "Demasiados intentos. Espera un momento." },
      { status: 429, headers: NO_STORE },
    )
  }

  const body = await parseBody(request)
  if (!body) {
    return Response.json(GENERIC_LOGIN_ERROR, { status: 401, headers: NO_STORE })
  }

  const sessionId = await getFloorRepository().iniciarSesion(body.usuarioId, body.pin)
  if (!sessionId) {
    return Response.json(GENERIC_LOGIN_ERROR, { status: 401, headers: NO_STORE })
  }

  return new Response(null, {
    status: 204,
    headers: { ...NO_STORE, "Set-Cookie": sessionCookieHeader(sessionId) },
  })
}

/** DELETE /api/sesion: idempotent logout -- an unknown/missing session
 * cookie is a silent no-op (closing is not a sensitive operation). */
export async function DELETE(request: Request): Promise<Response> {
  const sessionId = readSessionId(request)
  if (sessionId) {
    await getFloorRepository().cerrarSesion(sessionId)
  }

  return new Response(null, {
    status: 204,
    headers: { ...NO_STORE, "Set-Cookie": clearedSessionCookieHeader() },
  })
}

async function parseBody(request: Request): Promise<{ usuarioId: string; pin: string } | null> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return null
  }
  if (
    typeof json !== "object" ||
    json === null ||
    typeof (json as Record<string, unknown>).usuarioId !== "string" ||
    typeof (json as Record<string, unknown>).pin !== "string"
  ) {
    return null
  }
  const { usuarioId, pin } = json as { usuarioId: string; pin: string }
  return { usuarioId, pin }
}
