import { describe, expect, it } from "vitest"
import { construirReporteEstadoActual } from "@/lib/backoffice/reporte-estado-actual"

const FECHA = new Date("2026-09-28T14:05:00Z").getTime()

describe("construirReporteEstadoActual", () => {
  it("includes every line's state word and open-alert count", () => {
    const reporte = construirReporteEstadoActual({
      fecha: FECHA,
      lineas: [
        { nombre: "Línea 1 · Chasis", estadoKpi: "ok", alertasAbiertas: 0 },
        { nombre: "Línea 3 · Motores", estadoKpi: "parar", alertasAbiertas: 3 },
      ],
      appBaseUrl: "https://example.com",
    })
    expect(reporte.text).toContain("Línea 1 · Chasis")
    expect(reporte.text).toContain("OK")
    expect(reporte.text).toContain("Línea 3 · Motores")
    expect(reporte.text).toContain("PARAR")
    expect(reporte.text).toContain("3")
  })

  it("includes a date/time subject and the floor link", () => {
    const reporte = construirReporteEstadoActual({
      fecha: FECHA,
      lineas: [],
      appBaseUrl: "https://example.com/",
    })
    expect(reporte.subject).toContain("Reporte de estado")
    expect(reporte.text).toContain("https://example.com/planta")
    expect(reporte.html).toContain("https://example.com/planta")
  })
})
