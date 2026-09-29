import { describe, expect, it } from "vitest"
import { construirReporteTurno } from "@/lib/backoffice/reporte-turno"
import type { Alerta } from "@/lib/mock-data"
import type { IndicadorTablero } from "@/lib/domain/floor-repository"

const FECHA = new Date("2026-09-28T14:05:00Z").getTime()

function alerta(severidad: Alerta["severidad"], titulo: string): Alerta {
  return { id: titulo, severidad, titulo, estacion: "Estación 1", timestamp: FECHA, estado: "nueva" }
}

const INDICADORES: IndicadorTablero[] = [
  { id: "fpy", nombre: "FPY", detalle: "detalle", estado: "ok" },
  { id: "dph", nombre: "Defectos por hora", detalle: "detalle", estado: "atencion" },
  { id: "scrap", nombre: "Scrap", detalle: "detalle", estado: "parar" },
]

describe("construirReporteTurno", () => {
  it("includes the line and date/time in the subject", () => {
    const reporte = construirReporteTurno({
      linea: "Línea 3 · Motores",
      fecha: FECHA,
      nuevasAlertas: [],
      indicadores: INDICADORES,
      alertasAbiertas: 0,
      appBaseUrl: "https://example.com",
    })
    expect(reporte.subject).toContain("Reporte de turno")
    expect(reporte.subject).toContain("Línea 3 · Motores")
  })

  it("groups new alerts by severity word (ALTA/MEDIA/BAJA) with counts and titles", () => {
    const reporte = construirReporteTurno({
      linea: "Línea 3 · Motores",
      fecha: FECHA,
      nuevasAlertas: [alerta("parar", "Paro de línea"), alerta("atencion", "Nivel bajo")],
      indicadores: INDICADORES,
      alertasAbiertas: 5,
      appBaseUrl: "https://example.com",
    })
    expect(reporte.text).toContain("ALTA")
    expect(reporte.text).toContain("Paro de línea")
    expect(reporte.text).toContain("MEDIA")
    expect(reporte.text).toContain("Nivel bajo")
    expect(reporte.text).not.toContain("BAJA")
    expect(reporte.html).toContain("Paro de línea")
  })

  it("reports 'no new alerts' when the shift generated none", () => {
    const reporte = construirReporteTurno({
      linea: "Línea 3 · Motores",
      fecha: FECHA,
      nuevasAlertas: [],
      indicadores: INDICADORES,
      alertasAbiertas: 0,
      appBaseUrl: "https://example.com",
    })
    expect(reporte.text.toLowerCase()).toContain("sin alertas nuevas")
  })

  it("includes each KPI's state word", () => {
    const reporte = construirReporteTurno({
      linea: "Línea 3 · Motores",
      fecha: FECHA,
      nuevasAlertas: [],
      indicadores: INDICADORES,
      alertasAbiertas: 0,
      appBaseUrl: "https://example.com",
    })
    expect(reporte.text).toContain("FPY: OK")
    expect(reporte.text).toContain("Defectos por hora: ATENCIÓN")
    expect(reporte.text).toContain("Scrap: PARAR")
  })

  it("includes the still-open alert count and a link built from appBaseUrl", () => {
    const reporte = construirReporteTurno({
      linea: "Línea 3 · Motores",
      fecha: FECHA,
      nuevasAlertas: [],
      indicadores: INDICADORES,
      alertasAbiertas: 7,
      appBaseUrl: "https://example.com",
    })
    expect(reporte.text).toContain("7")
    expect(reporte.text).toContain("https://example.com/planta")
    expect(reporte.html).toContain("https://example.com/planta")
  })
})
