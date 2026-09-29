import { describe, expect, it } from "vitest"
import {
  estadoTrasResincronizar,
  extraerMensajeError,
  mensajeErrorActivar,
  mensajeErrorDesactivar,
} from "@/lib/oficina/push-toggle-logic"

describe("mensajeErrorActivar", () => {
  it("uses the cap-specific wording for a 429", () => {
    expect(mensajeErrorActivar(429, null)).toBe(
      "No se pudo activar: se alcanzó el límite de suscripciones. Intenta más tarde.",
    )
  })

  it("includes the server-supplied error for any other failing status", () => {
    expect(mensajeErrorActivar(400, "Suscripción inválida.")).toBe("No se pudo activar: Suscripción inválida.")
    expect(mensajeErrorActivar(500, "Error interno.")).toBe("No se pudo activar: Error interno.")
  })

  it("falls back to a generic wording when the server gave no error message", () => {
    expect(mensajeErrorActivar(500, null)).toBe("No se pudo activar: error del servidor.")
  })
})

describe("mensajeErrorDesactivar", () => {
  it("includes the server-supplied error", () => {
    expect(mensajeErrorDesactivar("boom")).toBe("No se pudo desactivar en el servidor: boom")
  })

  it("falls back to a generic wording when the server gave no error message", () => {
    expect(mensajeErrorDesactivar(null)).toBe("No se pudo desactivar en el servidor: error del servidor.")
  })
})

describe("estadoTrasResincronizar", () => {
  it("shows 'activadas' only when the server accepted the re-sync upsert", () => {
    expect(estadoTrasResincronizar(true)).toEqual({ estado: "activadas", mensaje: null })
  })

  it("surfaces an error instead of claiming 'activadas' when the server rejected the re-sync", () => {
    expect(estadoTrasResincronizar(false)).toEqual({
      estado: "error",
      mensaje: "No se pudo sincronizar la suscripción con el servidor.",
    })
  })
})

describe("extraerMensajeError", () => {
  it("reads the error field from a parsed JSON body", () => {
    expect(extraerMensajeError({ error: "boom" })).toBe("boom")
  })

  it("returns null for a missing/non-string error field, or a non-object body", () => {
    expect(extraerMensajeError({})).toBeNull()
    expect(extraerMensajeError({ error: 123 })).toBeNull()
    expect(extraerMensajeError(null)).toBeNull()
    expect(extraerMensajeError("plain string")).toBeNull()
  })
})
