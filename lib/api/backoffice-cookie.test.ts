import { describe, expect, it } from "vitest"
import { BACKOFFICE_COOKIE_NAME, backofficeCookieHeader, readBackofficeToken } from "./backoffice-cookie"

function reqWithCookie(cookie: string | null): Request {
  const headers = new Headers()
  if (cookie !== null) headers.set("cookie", cookie)
  return new Request("http://localhost/api/backoffice/sesion", { headers })
}

describe("readBackofficeToken", () => {
  it("returns null when there is no cookie header", () => {
    expect(readBackofficeToken(reqWithCookie(null))).toBeNull()
  })

  it("returns null when the cookie is absent among other cookies", () => {
    expect(readBackofficeToken(reqWithCookie("other=1; another=2"))).toBeNull()
  })

  it("round-trips a token written by backofficeCookieHeader", () => {
    const header = backofficeCookieHeader("abc123")
    const cookiePair = header.split(";")[0]
    expect(readBackofficeToken(reqWithCookie(cookiePair))).toBe("abc123")
  })

  it("decodes a percent-encoded value", () => {
    expect(readBackofficeToken(reqWithCookie(`${BACKOFFICE_COOKIE_NAME}=a%20b`))).toBe("a b")
  })

  // B4 (RDD review 2026-09-28): decodeURIComponent throws URIError on a
  // malformed percent-encoding (e.g. a lone "%"); this must return null
  // instead of letting the route handler crash with a 500.
  it("returns null (does not throw) on a malformed percent-encoding", () => {
    expect(() => readBackofficeToken(reqWithCookie(`${BACKOFFICE_COOKIE_NAME}=%E0%A4%A`))).not.toThrow()
    expect(readBackofficeToken(reqWithCookie(`${BACKOFFICE_COOKIE_NAME}=%E0%A4%A`))).toBeNull()
  })
})
