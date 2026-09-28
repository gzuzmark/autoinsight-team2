import { afterEach, describe, expect, it, vi } from "vitest"
import { ejecutarAccion } from "./acciones"

// B1 (RDD review 2026-09-28): backoffice-dashboard.tsx's onSalir had a
// try/finally with no catch -- a network error left "Salir" disabled
// forever and threw an unhandled rejection. `ejecutarAccion` is the shared,
// directly-unit-testable logic behind every back-office fetch button
// (Salir, Reiniciar demo, Simular turno): it always resolves (never
// throws), reports ok/error, and never leaves the caller uncertain whether
// the busy state should clear.

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ejecutarAccion", () => {
  it("resolves ok on a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const resultado = await ejecutarAccion("/api/backoffice/sesion", { method: "DELETE" })
    expect(resultado).toEqual({ ok: true })
  })

  it("resolves with the server error message on a non-ok JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Línea inválida." }), { status: 400 })),
    )
    const resultado = await ejecutarAccion("/api/backoffice/turno", { method: "POST" })
    expect(resultado).toEqual({ ok: false, error: "Línea inválida." })
  })

  it("resolves with a generic error on a non-ok response with no JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 500 })))
    const resultado = await ejecutarAccion("/api/backoffice/reiniciar", { method: "POST" })
    expect(resultado).toEqual({ ok: false, error: "No se pudo completar la acción." })
  })

  it("never throws -- a network error resolves with an error result instead", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
    await expect(ejecutarAccion("/api/backoffice/sesion", { method: "DELETE" })).resolves.toEqual({
      ok: false,
      error: "No se pudo completar la acción.",
    })
  })
})
