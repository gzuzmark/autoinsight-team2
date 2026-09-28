import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetThrottleForTests } from "@/lib/api/login-throttle"
import { BACKOFFICE_COOKIE_NAME } from "@/lib/api/backoffice-cookie"
import { currentToken } from "@/lib/backoffice/key-gate"
import { DELETE, POST } from "./route"

function req(body: unknown, ip = "10.0.0.1"): Request {
  return new Request("http://localhost/api/backoffice/sesion", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  })
}

function malformedReq(ip = "10.0.0.1"): Request {
  return new Request("http://localhost/api/backoffice/sesion", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: "{not json",
  })
}

describe("POST /api/backoffice/sesion", () => {
  beforeEach(() => {
    resetThrottleForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("fails closed with 503 when BACKOFFICE_KEY is unset, regardless of body", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "")
    const res = await POST(req({ clave: "anything" }))

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: "Back office deshabilitado: falta BACKOFFICE_KEY" })
    expect(res.headers.get("set-cookie")).toBeNull()
  })

  it("returns 401 with a generic message on the wrong key", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const res = await POST(req({ clave: "wrong" }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Clave incorrecta." })
    expect(res.headers.get("set-cookie")).toBeNull()
  })

  it("returns the SAME 401 message for malformed JSON", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const res = await POST(malformedReq())

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Clave incorrecta." })
  })

  it("returns 204 with a derived-token cookie (never the raw key) on the correct key", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const res = await POST(req({ clave: "dev-facilitador" }))

    expect(res.status).toBe(204)
    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toContain(`${BACKOFFICE_COOKIE_NAME}=`)
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("SameSite=Strict")
    expect(setCookie).toContain("Path=/")
    expect(setCookie).toMatch(/Max-Age=43200\b/)
    expect(setCookie).not.toContain("dev-facilitador")
    expect(setCookie).toContain(currentToken()!)
  })

  it("sets Cache-Control: no-store on every response", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const res = await POST(req({ clave: "wrong" }))
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("throttles after too many attempts from the same client (shared per-IP throttle)", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const ip = "10.0.0.9"
    let last: Response | undefined
    for (let i = 0; i < 11; i++) {
      last = await POST(req({ clave: "wrong" }, ip))
    }

    expect(last!.status).toBe(429)
    expect(await last!.json()).toEqual({ error: "Demasiados intentos. Espera un momento." })
  })

  it("does not throttle a different client", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    for (let i = 0; i < 11; i++) {
      await POST(req({ clave: "wrong" }, "10.0.0.2"))
    }
    const res = await POST(req({ clave: "dev-facilitador" }, "10.0.0.3"))

    expect(res.status).toBe(204)
  })
})

describe("DELETE /api/backoffice/sesion", () => {
  beforeEach(() => {
    resetThrottleForTests()
  })

  it("returns 204 and clears the cookie", async () => {
    const res = await DELETE(new Request("http://localhost/api/backoffice/sesion", { method: "DELETE" }))

    expect(res.status).toBe(204)
    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toContain(`${BACKOFFICE_COOKIE_NAME}=;`)
    expect(setCookie).toMatch(/Max-Age=0\b/)
  })

  it("is idempotent with no session cookie present", async () => {
    const res = await DELETE(new Request("http://localhost/api/backoffice/sesion", { method: "DELETE" }))
    expect(res.status).toBe(204)
  })
})
