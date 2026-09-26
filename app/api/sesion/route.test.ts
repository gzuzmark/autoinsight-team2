import { beforeEach, describe, expect, it } from "vitest"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { resetThrottleForTests } from "@/lib/api/login-throttle"
import { SESSION_COOKIE_NAME } from "@/lib/api/session-cookie"
import { USUARIOS } from "@/lib/mock-data"
import { DELETE, POST } from "./route"

function req(body: unknown, ip = "1.1.1.1"): Request {
  return new Request("http://localhost/api/sesion", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  })
}

function malformedReq(ip = "1.1.1.1"): Request {
  return new Request("http://localhost/api/sesion", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: "{not json",
  })
}

describe("POST /api/sesion", () => {
  beforeEach(() => {
    setFloorRepositoryForTests(new InMemoryFloorRepository())
    resetThrottleForTests()
  })

  it("returns 204 with a session cookie on correct PIN", async () => {
    const res = await POST(req({ usuarioId: USUARIOS[0].id, pin: USUARIOS[0].pin }))

    expect(res.status).toBe(204)
    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("SameSite=Strict")
    expect(setCookie).toContain("Path=/")
    expect(setCookie).toMatch(/Max-Age=43200\b/)
  })

  it("returns 401 with a generic message on wrong PIN", async () => {
    const res = await POST(req({ usuarioId: USUARIOS[0].id, pin: "0000" }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "PIN incorrecto." })
    expect(res.headers.get("set-cookie")).toBeNull()
  })

  it("returns the SAME 401 message for an unknown user (no enumeration)", async () => {
    const res = await POST(req({ usuarioId: "does-not-exist", pin: "1234" }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "PIN incorrecto." })
  })

  it("returns the SAME 401 message for malformed JSON", async () => {
    const res = await POST(malformedReq())

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "PIN incorrecto." })
  })

  it("returns the SAME 401 message for a missing field", async () => {
    const res = await POST(req({ usuarioId: USUARIOS[0].id }))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "PIN incorrecto." })
  })

  it("throttles after too many attempts from the same client", async () => {
    const ip = "9.9.9.9"
    let last: Response | undefined
    for (let i = 0; i < 11; i++) {
      last = await POST(req({ usuarioId: USUARIOS[0].id, pin: "0000" }, ip))
    }

    expect(last!.status).toBe(429)
    expect(await last!.json()).toEqual({ error: "Demasiados intentos. Espera un momento." })
  })

  it("does not throttle a different client", async () => {
    for (let i = 0; i < 11; i++) {
      await POST(req({ usuarioId: USUARIOS[0].id, pin: "0000" }, "2.2.2.2"))
    }
    const res = await POST(req({ usuarioId: USUARIOS[0].id, pin: USUARIOS[0].pin }, "3.3.3.3"))

    expect(res.status).toBe(204)
  })

  it("sets Cache-Control: no-store on every response", async () => {
    const res = await POST(req({ usuarioId: USUARIOS[0].id, pin: "0000" }))
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})

describe("DELETE /api/sesion", () => {
  beforeEach(() => {
    setFloorRepositoryForTests(new InMemoryFloorRepository())
    resetThrottleForTests()
  })

  it("returns 204 and clears the cookie", async () => {
    const res = await DELETE(new Request("http://localhost/api/sesion", { method: "DELETE" }))

    expect(res.status).toBe(204)
    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=;`)
    expect(setCookie).toMatch(/Max-Age=0\b/)
  })

  it("is idempotent with no session cookie present", async () => {
    const res = await DELETE(new Request("http://localhost/api/sesion", { method: "DELETE" }))
    expect(res.status).toBe(204)
  })
})
