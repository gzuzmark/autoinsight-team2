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
      <SinceLastVisit primeraVisita={true} cambios={[]} ultimoLogoutTs={null} />,
    )

    expect(html).toBe("")
  })

  it('shows "Sin cambios" with the last logout time when nothing changed', () => {
    const ts = new Date(2026, 8, 25, 14, 5).getTime()

    const html = renderToStaticMarkup(
      <SinceLastVisit primeraVisita={false} cambios={[]} ultimoLogoutTs={ts} />,
    )

    expect(html).toContain("Sin cambios desde tu última visita, 14:05")
  })

  it("shows one short line for one change", () => {
    const cambios = [makeAlert({ id: "a1", titulo: "FPY bajo", estacion: "Estación 4 · Ensamble" })]

    const html = renderToStaticMarkup(
      <SinceLastVisit primeraVisita={false} cambios={cambios} ultimoLogoutTs={null} />,
    )

    expect(html).toContain("Desde tu última visita")
    expect(html).toContain("Estación 4 · Ensamble")
  })

  it("shows up to three short lines for three or more changes", () => {
    const cambios = [
      makeAlert({ id: "a1", titulo: "Uno", estacion: "E1" }),
      makeAlert({ id: "a2", titulo: "Dos", estacion: "E2" }),
      makeAlert({ id: "a3", titulo: "Tres", estacion: "E3" }),
      makeAlert({ id: "a4", titulo: "Cuatro", estacion: "E4" }),
    ]

    const html = renderToStaticMarkup(
      <SinceLastVisit primeraVisita={false} cambios={cambios} ultimoLogoutTs={null} />,
    )

    expect(html).toContain("E1")
    expect(html).toContain("E2")
    expect(html).toContain("E3")
    expect(html).not.toContain("E4")
  })
})
