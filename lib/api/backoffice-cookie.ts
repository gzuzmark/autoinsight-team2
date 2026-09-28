import "server-only"

/**
 * Manual Cookie/Set-Cookie handling for the /backoffice facilitator session
 * (G1), mirroring lib/api/session-cookie.ts's approach: reading/writing the
 * header directly works identically for a real Next request and a route
 * handler called directly with a native `Request` in a unit test.
 */

export const BACKOFFICE_COOKIE_NAME = "backoffice_sesion"

const TWELVE_HOURS_SECONDS = 12 * 60 * 60

export function readBackofficeToken(request: Request): string | null {
  const header = request.headers.get("cookie")
  if (!header) return null
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=")
    if (rawName === BACKOFFICE_COOKIE_NAME) {
      return decodeURIComponent(rawValue.join("="))
    }
  }
  return null
}

export function backofficeCookieHeader(token: string): string {
  return buildCookieHeader(encodeURIComponent(token), `Max-Age=${TWELVE_HOURS_SECONDS}`)
}

export function clearedBackofficeCookieHeader(): string {
  return buildCookieHeader("", "Max-Age=0")
}

function buildCookieHeader(value: string, maxAge: string): string {
  const parts = [`${BACKOFFICE_COOKIE_NAME}=${value}`, "Path=/", maxAge, "HttpOnly", "SameSite=Strict"]
  if (process.env.NODE_ENV === "production") parts.push("Secure")
  return parts.join("; ")
}
