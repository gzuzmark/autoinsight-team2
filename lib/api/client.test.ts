import { afterEach, describe, expect, it, vi } from "vitest"
import { api } from "@/lib/api/client"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("api.usuarios", () => {
  it("GETs /api/usuarios and returns the parsed list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: "u1" }]))
    vi.stubGlobal("fetch", fetchMock)

    const result = await api.usuarios()

    expect(fetchMock).toHaveBeenCalledWith("/api/usuarios")
    expect(result).toEqual([{ id: "u1" }])
  })

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })))
    await expect(api.usuarios()).rejects.toThrow()
  })
})

describe("api.login", () => {
  it("returns ok:true on 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const result = await api.login("u1", "1234")
    expect(result).toEqual({ ok: true })
  })

  it("returns ok:false with the server message and status on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "PIN incorrecto." }, 401)))
    const result = await api.login("u1", "0000")
    expect(result).toEqual({ ok: false, status: 401, message: "PIN incorrecto." })
  })

  it("returns ok:false with the throttle message and status on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Demasiados intentos. Espera un momento." }, 429)),
    )
    const result = await api.login("u1", "0000")
    expect(result).toEqual({
      ok: false,
      status: 429,
      message: "Demasiados intentos. Espera un momento.",
    })
  })

  it("posts usuarioId and pin as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)

    await api.login("u1", "1234")

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sesion",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ usuarioId: "u1", pin: "1234" }),
      }),
    )
  })
})

describe("api.logout", () => {
  it("calls DELETE /api/sesion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal("fetch", fetchMock)

    await api.logout()

    expect(fetchMock).toHaveBeenCalledWith("/api/sesion", { method: "DELETE" })
  })
})

describe("api.tablero", () => {
  it("GETs /api/tablero and returns the parsed tablero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ usuario: { id: "u1" } })))
    const result = await api.tablero()
    expect(result).toEqual({ usuario: { id: "u1" } })
  })

  it("throws on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "x" }, 401)))
    await expect(api.tablero()).rejects.toThrow()
  })
})

describe("api.resolver", () => {
  it("posts the resolution and returns the updated tablero", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ usuario: { id: "u1" } }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await api.resolver("a1", "atendida")

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/alertas/a1/resolver",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ resolucion: "atendida" }) }),
    )
    expect(result).toEqual({ usuario: { id: "u1" } })
  })
})

describe("api.simular", () => {
  it("POSTs /api/demo/simular and returns the updated tablero", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ usuario: { id: "u1" } }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await api.simular()

    expect(fetchMock).toHaveBeenCalledWith("/api/demo/simular", { method: "POST" })
    expect(result).toEqual({ usuario: { id: "u1" } })
  })
})
