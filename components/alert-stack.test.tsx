import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Alerta } from "@/lib/mock-data"
import { AlertStack } from "./alert-stack"

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

describe("AlertStack", () => {
  it('shows "Sin alertas abiertas" when there are no active alerts', () => {
    const html = renderToStaticMarkup(<AlertStack alertas={[]} onAbrir={() => {}} nuevasIds={new Set()} />)

    expect(html).toContain("Sin alertas abiertas")
  })

  it("shows the plural overflow text for more than one extra alert", () => {
    const alertas = Array.from({ length: 5 }, (_, i) => makeAlert({ id: `a${i}`, timestamp: i }))

    const html = renderToStaticMarkup(<AlertStack alertas={alertas} onAbrir={() => {}} nuevasIds={new Set()} />)

    expect(html).toContain("+2 alertas menos graves")
  })

  it("shows the singular overflow text for exactly one extra alert", () => {
    const alertas = Array.from({ length: 4 }, (_, i) => makeAlert({ id: `a${i}`, timestamp: i }))

    const html = renderToStaticMarkup(<AlertStack alertas={alertas} onAbrir={() => {}} nuevasIds={new Set()} />)

    expect(html).toContain("+1 alerta menos grave")
  })

  it("shows no overflow text for three or fewer alerts", () => {
    const alertas = Array.from({ length: 3 }, (_, i) => makeAlert({ id: `a${i}`, timestamp: i }))

    const html = renderToStaticMarkup(<AlertStack alertas={alertas} onAbrir={() => {}} nuevasIds={new Set()} />)

    expect(html).not.toContain("menos grave")
  })
})
