import { describe, expect, it } from "vitest"
import type { ResumenOficina } from "@/lib/domain/floor-repository"
import { resumenOficinaAFilasTabla, resumenOficinaAKpis } from "@/lib/oficina/resumen-vista"

const RESUMEN_BASE: ResumenOficina = {
  indicadores: [
    {
      clave: "fpy",
      nombre: "FPY planta",
      unidad: "%",
      promedio: 90.9,
      estado: "parar",
      porLinea: [
        { linea: "Línea 1 · Chasis", valor: 94.2, estado: "ok" },
        { linea: "Línea 2 · Pintura", valor: 90.1, estado: "atencion" },
        { linea: "Línea 3 · Motores", valor: 88.4, estado: "parar" },
      ],
    },
    {
      clave: "dph",
      nombre: "Defectos / hora",
      unidad: "defectos/h",
      promedio: 3.8,
      estado: "ok",
      porLinea: [],
    },
    {
      clave: "scrap",
      nombre: "Scrap",
      unidad: "%",
      promedio: 1.6,
      estado: "ok",
      porLinea: [],
    },
  ],
  alertasAbiertas: 17,
  alertasAbiertasAlta: 7,
  tiempoMedioAtencionMin: 23,
  ultimasAlertas: [
    {
      id: "a1",
      titulo: "Torque fuera de rango",
      severidad: "parar",
      linea: "Línea 3 · Motores",
      estacion: "Estación 7 · Atornillado",
      estado: "nueva",
      creadaEn: 1000,
    },
    {
      id: "a2",
      titulo: "Scrap por encima",
      severidad: "atencion",
      linea: "Línea 2 · Pintura",
      estacion: null,
      estado: "atendida",
      creadaEn: 500,
    },
  ],
}

describe("resumenOficinaAKpis (G10)", () => {
  it("formats the fpy/dph/scrap plant averages with a comma decimal and the right unit", () => {
    const kpis = resumenOficinaAKpis(RESUMEN_BASE)
    const fpy = kpis.find((k) => k.id === "fpy")!
    expect(fpy.valor).toBe("90,9 %")
    const dph = kpis.find((k) => k.id === "dph")!
    expect(dph.valor).toBe("3,8")
  })

  it("includes a per-line tooltip for an indicator KPI", () => {
    const kpis = resumenOficinaAKpis(RESUMEN_BASE)
    const fpy = kpis.find((k) => k.id === "fpy")!
    expect(fpy.tooltip).toContain("Línea 1 · Chasis")
    expect(fpy.tooltip).toContain("94,2 %")
  })

  it("shows the open-alert count with the ALTA subset as its nota", () => {
    const kpis = resumenOficinaAKpis(RESUMEN_BASE)
    const alertas = kpis.find((k) => k.id === "alertas")!
    expect(alertas.valor).toBe("17")
    expect(alertas.nota).toBe("7 de gravedad ALTA")
  })

  it("shows the mean attention time in minutes when known", () => {
    const kpis = resumenOficinaAKpis(RESUMEN_BASE)
    const atencion = kpis.find((k) => k.id === "atencion")!
    expect(atencion.valor).toBe("23 min")
  })

  it("shows an em dash for the mean attention time when null, never a fabricated 0", () => {
    const kpis = resumenOficinaAKpis({ ...RESUMEN_BASE, tiempoMedioAtencionMin: null })
    const atencion = kpis.find((k) => k.id === "atencion")!
    expect(atencion.valor).toBe("—")
  })
})

describe("resumenOficinaAFilasTabla (G10)", () => {
  it("maps severity/estado/hace for the latest-alerts table, newest first as given", () => {
    const filas = resumenOficinaAFilasTabla(RESUMEN_BASE)
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({
      id: "a1",
      gravedad: "ALTA",
      titulo: "Torque fuera de rango",
      estado: "Nueva",
    })
    expect(filas[0].lineaEstacion).toContain("Línea 3 · Motores")
    expect(filas[1].estado).toBe("Atendida")
  })

  it("falls back to just the line name when the alert has no station", () => {
    const filas = resumenOficinaAFilasTabla(RESUMEN_BASE)
    expect(filas[1].lineaEstacion).toBe("Línea 2 · Pintura")
  })
})
