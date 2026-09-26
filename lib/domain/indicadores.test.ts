import { describe, expect, it } from "vitest"
import type { Indicador } from "@/lib/mock-data"
import { estadoIndicador, indicadorATablero } from "@/lib/domain/indicadores"

const FPY: Indicador = {
  id: "fpy",
  nombre: "FPY",
  detalle: "Rendimiento a primera pasada",
  valor: 88.4,
  unidad: "%",
  mayorEsMejor: true,
  umbralAtencion: 92,
  umbralParar: 90,
  actualizadoEn: 1_000,
}

const DPH: Indicador = {
  id: "dph",
  nombre: "Defectos / hora",
  detalle: "Umbral de atención 4-6",
  valor: 5,
  unidad: "defectos/h",
  mayorEsMejor: false,
  umbralAtencion: 4,
  umbralParar: 6,
  actualizadoEn: 1_000,
}

const SCRAP: Indicador = {
  id: "scrap",
  nombre: "Scrap",
  detalle: "Dentro del objetivo (<= 2 %)",
  valor: 1.6,
  unidad: "%",
  mayorEsMejor: false,
  umbralAtencion: 2,
  umbralParar: 3,
  actualizadoEn: 1_000,
}

describe("estadoIndicador", () => {
  describe("mayorEsMejor (e.g. FPY, atencion=92, parar=90)", () => {
    it("is parar strictly below the parar threshold", () => {
      expect(estadoIndicador(88.4, true, 92, 90)).toBe("parar")
      expect(estadoIndicador(89.99, true, 92, 90)).toBe("parar")
    })

    it("is atencion at the parar boundary and up to (not including) the atencion threshold", () => {
      expect(estadoIndicador(90, true, 92, 90)).toBe("atencion")
      expect(estadoIndicador(91.99, true, 92, 90)).toBe("atencion")
    })

    it("is ok at and above the atencion threshold", () => {
      expect(estadoIndicador(92, true, 92, 90)).toBe("ok")
      expect(estadoIndicador(94.2, true, 92, 90)).toBe("ok")
    })
  })

  describe("lower-is-better (e.g. Defectos/hora, atencion=4, parar=6)", () => {
    it("is ok at and below the atencion threshold", () => {
      expect(estadoIndicador(2, false, 4, 6)).toBe("ok")
      expect(estadoIndicador(4, false, 4, 6)).toBe("ok")
    })

    it("is atencion strictly above the atencion threshold, up to and including the parar threshold", () => {
      expect(estadoIndicador(5, false, 4, 6)).toBe("atencion")
      expect(estadoIndicador(6, false, 4, 6)).toBe("atencion")
    })

    it("is parar strictly above the parar threshold", () => {
      expect(estadoIndicador(6.01, false, 4, 6)).toBe("parar")
    })
  })

  it("matches the seeded Línea 3 KPI states (FPY parar, Defectos atencion, Scrap ok)", () => {
    expect(estadoIndicador(FPY.valor, FPY.mayorEsMejor, FPY.umbralAtencion, FPY.umbralParar)).toBe("parar")
    expect(estadoIndicador(DPH.valor, DPH.mayorEsMejor, DPH.umbralAtencion, DPH.umbralParar)).toBe("atencion")
    expect(estadoIndicador(SCRAP.valor, SCRAP.mayorEsMejor, SCRAP.umbralAtencion, SCRAP.umbralParar)).toBe("ok")
  })
})

describe("indicadorATablero", () => {
  it("derives the tile shape (id, nombre, detalle, estado) with no numeric value", () => {
    const tile = indicadorATablero(FPY)
    expect(tile).toEqual({ id: "fpy", nombre: "FPY", detalle: FPY.detalle, estado: "parar" })
    expect(tile).not.toHaveProperty("valor")
  })
})

