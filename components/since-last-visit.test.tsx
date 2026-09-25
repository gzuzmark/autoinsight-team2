import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Alerta } from "@/lib/mock-data"
import { SinceLastVisit } from "./since-last-visit"

function makeAlert(overrides: Partial<Alerta>): Alerta {
  return {
    id: "id",
    severidad: "ok",
    titulo: "titulo",
    estacion: "estacion",
    timestamp: 0,
    estado: "nueva",
    ...overrides,
  }
}

describe("SinceLastVisit", () => {
  it("renders nothing on first visit", () => {
    const html = renderToStaticMarkup(
      <SinceLastVisit primeraVisita={true} cambios={[]} totalNuevos={0} ultimoLogoutTs={null} />,
    )

    expect(html).toBe("")
  })

  it('shows "Sin cambios" with the last logout time when nothing ever changed', () => {
    const ts = new Date(2026, 8, 25, 14, 5).getTime()

    const html = renderToStaticMarkup(
      <SinceLastVisit primeraVisita={false} cambios={[]} totalNuevos={0} ultimoLogoutTs={ts} />,
    )

    expect(html).toContain("Sin cambios desde tu última visita, 14:05")
  })

  it("renders nothing (F1) when every new alert has since been attended/no-aplica", () => {
    // totalNuevos > 0: there WERE changes at login, but none remain active
    // now (cambios is empty) — showing "Sin cambios" here would be false.
    const html = renderToStaticMarkup(
      <SinceLastVisit primeraVisita={false} cambios={[]} totalNuevos={2} ultimoLogoutTs={123} />,
    )

    expect(html).toBe("")
  })

  it("shows one aggregated line for one change at one station (singular)", () => {
    const cambios = [makeAlert({ id: "a1", estacion: "Estación 4 · Ensamble" })]

    const html = renderToStaticMarkup(
      <SinceLastVisit primeraVisita={false} cambios={cambios} totalNuevos={1} ultimoLogoutTs={null} />,
    )

    expect(html).toContain("Desde tu última visita")
    expect(html).toContain("1 alerta nueva en Estación 4 · Ensamble")
  })

  it("aggregates several changes at the same station with correct plural", () => {
    const cambios = [
      makeAlert({ id: "a1", estacion: "Estación 7 · Atornillado", severidad: "parar" }),
      makeAlert({ id: "a2", estacion: "Estación 7 · Atornillado", severidad: "atencion" }),
    ]

    const html = renderToStaticMarkup(
      <SinceLastVisit primeraVisita={false} cambios={cambios} totalNuevos={2} ultimoLogoutTs={null} />,
    )

    expect(html).toContain("2 alertas nuevas en Estación 7 · Atornillado")
  })

  it("shows both station lines with no overflow when there are exactly two stations", () => {
    const cambios = [makeAlert({ id: "a1", estacion: "E1" }), makeAlert({ id: "a2", estacion: "E2" })]

    const html = renderToStaticMarkup(
      <SinceLastVisit primeraVisita={false} cambios={cambios} totalNuevos={2} ultimoLogoutTs={null} />,
    )

    expect(html).toContain("E1")
    expect(html).toContain("E2")
    expect(html).not.toContain("estación más")
    expect(html).not.toContain("estaciones más")
  })

  it("caps at 2 station lines plus a singular overflow line for a third station", () => {
    const cambios = [
      makeAlert({ id: "a1", estacion: "E1", severidad: "parar" }),
      makeAlert({ id: "a2", estacion: "E2", severidad: "atencion" }),
      makeAlert({ id: "a3", estacion: "E3", severidad: "ok" }),
    ]

    const html = renderToStaticMarkup(
      <SinceLastVisit primeraVisita={false} cambios={cambios} totalNuevos={3} ultimoLogoutTs={null} />,
    )

    expect(html).toContain("E1")
    expect(html).toContain("E2")
    expect(html).not.toContain(">E3<")
    expect(html).toContain("+1 estación más")
  })

  it("caps at 2 station lines plus a plural overflow line for four or more stations", () => {
    const cambios = [
      makeAlert({ id: "a1", estacion: "E1", severidad: "parar" }),
      makeAlert({ id: "a2", estacion: "E2", severidad: "atencion" }),
      makeAlert({ id: "a3", estacion: "E3", severidad: "ok" }),
      makeAlert({ id: "a4", estacion: "E4", severidad: "ok" }),
    ]

    const html = renderToStaticMarkup(
      <SinceLastVisit primeraVisita={false} cambios={cambios} totalNuevos={4} ultimoLogoutTs={null} />,
    )

    expect(html).toContain("E1")
    expect(html).toContain("E2")
    expect(html).toContain("+2 estaciones más")
  })
})
