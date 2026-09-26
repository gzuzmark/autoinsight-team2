import "server-only"

/**
 * Manual Cookie/Set-Cookie handling (D21) instead of `next/headers`'
 * `cookies()`: that API depends on Next's per-request async-context store,
 * which is not populated when a route handler is called directly with a
 * native `Request` (as the tests here do -- see T8). Reading/writing the
 * header directly works identically in both a real Next request and a unit
 * test, and needs no framework runtime at all.
 */

export const SESSION_COOKIE_NAME = "sesion"

const TWELVE_HOURS_SECONDS = 12 * 60 * 60

export function readSessionId(request: Request): string | null {
  const header = request.headers.get("cookie")
  if (!header) return null
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=")
    if (rawName === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rawValue.join("="))
    }
  }
  return null
}

export function sessionCookieHeader(sessionId: string): string {
  return buildCookieHeader(encodeURIComponent(sessionId), `Max-Age=${TWELVE_HOURS_SECONDS}`)
}

export function clearedSessionCookieHeader(): string {
  return buildCookieHeader("", "Max-Age=0")
}

function buildCookieHeader(value: string, maxAge: string): string {
  const parts = [`${SESSION_COOKIE_NAME}=${value}`, "Path=/", maxAge, "HttpOnly", "SameSite=Strict"]
  if (process.env.NODE_ENV === "production") parts.push("Secure")
  return parts.join("; ")
}
