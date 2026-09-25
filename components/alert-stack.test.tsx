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

  it('marks only alerts present in nuevasIds with the sr-only "Nueva" label', () => {
    const alertas = [
      makeAlert({ id: "top", timestamp: 3 }),
      makeAlert({ id: "seen", timestamp: 2 }),
      makeAlert({ id: "new", timestamp: 1 }),
    ]

    const html = renderToStaticMarkup(
      <AlertStack alertas={alertas} onAbrir={() => {}} nuevasIds={new Set(["new"])} />,
    )

    expect(html.match(/Nueva/g)).toHaveLength(1)
  })

  it('renders the secondary row "Nueva" dot in normal flow (not absolutely positioned) so it cannot overlap the timestamp (F4)', () => {
    const alertas = [
      makeAlert({ id: "top", timestamp: 2 }),
      makeAlert({ id: "secondary", timestamp: 1 }),
    ]

    const html = renderToStaticMarkup(
      <AlertStack alertas={alertas} onAbrir={() => {}} nuevasIds={new Set(["secondary"])} />,
    )

    // Isolate the markup right after the secondary card's <button> tag opens.
    const afterAttr = html.split(`data-alert-id="secondary"`)[1] ?? ""
    const afterButtonOpenTag = afterAttr.slice(afterAttr.indexOf(">") + 1)
    // The first child element should be the dot's <span>, not absolutely positioned.
    const firstSpanOpenTag = afterButtonOpenTag.slice(0, afterButtonOpenTag.indexOf(">") + 1)
    expect(firstSpanOpenTag).toMatch(/^<span/)
    expect(firstSpanOpenTag).not.toContain("absolute")
    expect(afterButtonOpenTag).toContain("Nueva")
  })
})
