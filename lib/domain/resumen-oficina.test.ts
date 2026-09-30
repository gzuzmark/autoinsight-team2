import { describe, expect, it } from "vitest"
import { construirIndicadorResumen, tiempoMedioAtencionMin } from "@/lib/domain/resumen-oficina"

describe("construirIndicadorResumen (G10)", () => {
  it("averages the per-line values, rounded to 1 decimal", () => {
    const resultado = construirIndicadorResumen("fpy", "FPY planta", "%", [
      { linea: "Línea 1 · Chasis", valor: 94.2, estado: "ok" },
      { linea: "Línea 2 · Pintura", valor: 90.1, estado: "ok" },
      { linea: "Línea 3 · Motores", valor: 88.4, estado: "parar" },
    ])
    expect(resultado.promedio).toBeCloseTo(90.9, 1)
    expect(resultado.clave).toBe("fpy")
    expect(resultado.unidad).toBe("%")
  })

  it("takes the worst per-line state, never averaging severity", () => {
    const resultado = construirIndicadorResumen("dph", "Defectos / hora", "defectos/h", [
      { linea: "Línea 1 · Chasis", valor: 2, estado: "ok" },
      { linea: "Línea 2 · Pintura", valor: 4.5, estado: "atencion" },
      { linea: "Línea 3 · Motores", valor: 5, estado: "ok" },
    ])
    expect(resultado.estado).toBe("atencion")
  })

  it("keeps the per-line breakdown for a tooltip", () => {
    const porLinea = [
      { linea: "Línea 1 · Chasis" as const, valor: 1.9, estado: "ok" as const },
    ]
    const resultado = construirIndicadorResumen("scrap", "Scrap", "%", porLinea)
    expect(resultado.porLinea).toEqual(porLinea)
  })

  it("defaults to 0/ok when no line reported a value", () => {
    const resultado = construirIndicadorResumen("fpy", "FPY planta", "%", [])
    expect(resultado.promedio).toBe(0)
    expect(resultado.estado).toBe("ok")
  })
})

describe("tiempoMedioAtencionMin (G10)", () => {
  const ahora = Date.parse("2026-09-29T12:00:00Z")
  const HORA_MS = 60 * 60 * 1000

  it("returns null when nothing resolved yet", () => {
    expect(tiempoMedioAtencionMin([{ creadaEn: ahora - HORA_MS, resueltaEn: null }], ahora)).toBeNull()
  })

  it("returns null when no resolution falls inside the last 24h", () => {
    const resueltaEn = ahora - 25 * HORA_MS
    expect(tiempoMedioAtencionMin([{ creadaEn: resueltaEn - HORA_MS, resueltaEn }], ahora)).toBeNull()
  })

  it("averages resolution minutes across every alert resolved in the last 24h", () => {
    const alertas = [
      { creadaEn: ahora - 30 * 60_000, resueltaEn: ahora - 10 * 60_000 }, // 20 min
      { creadaEn: ahora - 50 * 60_000, resueltaEn: ahora - 20 * 60_000 }, // 30 min
    ]
    expect(tiempoMedioAtencionMin(alertas, ahora)).toBe(25)
  })

  it("ignores a resolution older than 24h while keeping recent ones", () => {
    const alertas = [
      { creadaEn: ahora - 30 * 60_000, resueltaEn: ahora - 10 * 60_000 }, // 20 min, recent
      { creadaEn: ahora - 26 * HORA_MS - 30 * 60_000, resueltaEn: ahora - 26 * HORA_MS }, // old
    ]
    expect(tiempoMedioAtencionMin(alertas, ahora)).toBe(20)
  })
})
