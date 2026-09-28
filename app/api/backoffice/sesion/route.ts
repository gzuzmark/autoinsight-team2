import "server-only"

import { clientKey, shouldThrottle } from "@/lib/api/login-throttle"
import { backofficeCookieHeader, clearedBackofficeCookieHeader } from "@/lib/api/backoffice-cookie"
import { currentToken, isBackofficeConfigured, verifyKey } from "@/lib/backoffice/key-gate"

const NO_STORE = { "Cache-Control": "no-store" }
const GENERIC_KEY_ERROR = { error: "Clave incorrecta." }

/** POST /api/backoffice/sesion: facilitator key login (G1, D28 amendment).
 * Fails closed with 503 when BACKOFFICE_KEY is unset -- the gate never opens
 * without an explicitly configured key. Every wrong-key/malformed-body
 * failure returns the exact same 401 body. Reuses the existing per-IP login
 * throttle (lib/api/login-throttle.ts) rather than duplicating it. */
export async function POST(request: Request): Promise<Response> {
  if (!isBackofficeConfigured()) {
    return Response.json(
      { error: "Back office deshabilitado: falta BACKOFFICE_KEY" },
      { status: 503, headers: NO_STORE },
    )
  }

  const key = clientKey(request)
  if (shouldThrottle(key)) {
    return Response.json(
      { error: "Demasiados intentos. Espera un momento." },
      { status: 429, headers: NO_STORE },
    )
  }

  const clave = await parseClave(request)
  if (!clave || !verifyKey(clave)) {
    return Response.json(GENERIC_KEY_ERROR, { status: 401, headers: NO_STORE })
  }

  const token = currentToken()
  if (!token) {
    // BACKOFFICE_KEY could have been cleared between the isBackofficeConfigured()
    // check above and here (env mutated mid-request) -- fail closed rather
    // than issue a cookie with no valid token to match.
    return Response.json(
      { error: "Back office deshabilitado: falta BACKOFFICE_KEY" },
      { status: 503, headers: NO_STORE },
    )
  }

  return new Response(null, {
    status: 204,
    headers: { ...NO_STORE, "Set-Cookie": backofficeCookieHeader(token) },
  })
}

/** DELETE /api/backoffice/sesion: idempotent logout -- an unknown/missing
 * cookie is a silent no-op (the gate is stateless, so there is nothing else
 * to close server-side). */
export async function DELETE(_request: Request): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: { ...NO_STORE, "Set-Cookie": clearedBackofficeCookieHeader() },
  })
}

async function parseClave(request: Request): Promise<string | null> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return null
  }
  if (typeof json !== "object" || json === null || typeof (json as Record<string, unknown>).clave !== "string") {
    return null
  }
  return (json as { clave: string }).clave
}
