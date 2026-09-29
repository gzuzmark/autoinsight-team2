import { describe, expect, it } from "vitest"
import { construirPayloadAlerta } from "@/lib/push/payload"
import type { Alerta } from "@/lib/mock-data"

const ALERTA: Alerta = {
  id: "a1",
  severidad: "parar",
  titulo: "Torque fuera de rango",
  estacion: "Estación 7 · Atornillado",
  timestamp: Date.now(),
  estado: "nueva",
}

describe("construirPayloadAlerta", () => {
  it("builds a title naming the line and severity", () => {
    const payload = construirPayloadAlerta("Línea 3 · Motores", ALERTA)
    expect(payload.title).toBe("Alerta ALTA · Línea 3 · Motores")
  })

  it("body carries the alert title and station", () => {
    const payload = construirPayloadAlerta("Línea 3 · Motores", ALERTA)
    expect(payload.body).toBe("Torque fuera de rango · Estación 7 · Atornillado")
  })

  it("falls back to a generic station label when the alert has none", () => {
    const payload = construirPayloadAlerta("Línea 3 · Motores", { ...ALERTA, estacion: "" })
    expect(payload.body).toBe("Torque fuera de rango · Estación sin especificar")
  })

  it("tags per-alert so a retrigger replaces the previous notification instead of stacking", () => {
    const payload = construirPayloadAlerta("Línea 3 · Motores", ALERTA)
    expect(payload.tag).toBe("alerta-a1")
  })

  it("url points at the office investigation screen for that alert", () => {
    const payload = construirPayloadAlerta("Línea 3 · Motores", ALERTA)
    expect(payload.url).toBe("/oficina/alertas/a1")
  })
})
