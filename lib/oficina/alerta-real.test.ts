import { describe, expect, it } from "vitest"
import type { AlertaDetalle } from "@/lib/domain/floor-repository"
import { alertaDetalleAOficina } from "@/lib/oficina/alerta-real"

const BASE: AlertaDetalle = {
  id: "a1",
  severidad: "parar",
  titulo: "Torque fuera de rango",
  linea: "Línea 3 · Motores",
  estacion: "Estación 7 · Atornillado",
  estado: "nueva",
  valor: 12.5,
  limite: 10,
  unidad: "Nm",
  creadaEn: Date.UTC(2026, 8, 29, 8, 0),
  resueltaEn: null,
}

describe("alertaDetalleAOficina", () => {
  it("maps severidad to the ALTA/MEDIA/BAJA alert vocabulary (D8), not the OK/ATENCIÓN/PARAR KPI words", () => {
    expect(alertaDetalleAOficina(BASE).gravedad).toBe("ALTA")
    expect(alertaDetalleAOficina({ ...BASE, severidad: "atencion" }).gravedad).toBe("MEDIA")
    expect(alertaDetalleAOficina({ ...BASE, severidad: "ok" }).gravedad).toBe("BAJA")
  })

  it("marks the result as real and shows a real value/limite string", () => {
    const alerta = alertaDetalleAOficina(BASE)
    expect(alerta.esReal).toBe(true)
    expect(alerta.valorLimite).toBe("12.5 Nm / 10 Nm")
  })

  it("shows 'Sin datos' instead of a fabricated value when valor/limite are unavailable (mock mode)", () => {
    const alerta = alertaDetalleAOficina({ ...BASE, valor: null, limite: null, unidad: null })
    expect(alerta.valorLimite).toBe("Sin datos")
  })

  it("maps estado onto the office vocabulary", () => {
    expect(alertaDetalleAOficina({ ...BASE, estado: "atendida" }).estado).toBe("Atendida")
    expect(alertaDetalleAOficina({ ...BASE, estado: "no_aplica" }).estado).toBe("No aplica")
  })

  it("adds a resolution history entry only when resueltaEn is known", () => {
    expect(alertaDetalleAOficina(BASE).historial.length).toBe(1)
    const resuelta = alertaDetalleAOficina({
      ...BASE,
      estado: "atendida",
      resueltaEn: Date.UTC(2026, 8, 29, 8, 30),
    })
    expect(resuelta.historial.length).toBe(2)
    expect(resuelta.historial[1].titulo).toBe("Marcada como Atendida")
  })

  it("returns empty chart series and no 8D steps (no real backing data), not fabricated sample content", () => {
    const alerta = alertaDetalleAOficina(BASE)
    expect(alerta.metrica.serie).toEqual([])
    expect(alerta.ocho_d).toEqual([])
  })
})
