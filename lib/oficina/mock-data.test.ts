import { describe, expect, it } from "vitest"
import {
  barraFueraDeLimite,
  fpyBarEstado,
  fpyBarHeightPercent,
  heatmapBucket,
  reporteVariante,
  ALERTAS,
  FPY_TENDENCIA,
  PARETO_DEFECTOS,
  KPIS,
  REPORTES,
  getAlertaPorId,
} from "./mock-data"

describe("fpyBarEstado (pure helper: FPY 30-day bar color by threshold)", () => {
  it("returns 'ok' at and above 92", () => {
    expect(fpyBarEstado(92)).toBe("ok")
    expect(fpyBarEstado(97)).toBe("ok")
  })

  it("returns 'atencion' between 90 and 92 (exclusive of 92, inclusive of 90)", () => {
    expect(fpyBarEstado(90)).toBe("atencion")
    expect(fpyBarEstado(91.5)).toBe("atencion")
  })

  it("returns 'parar' below 90", () => {
    expect(fpyBarEstado(89.9)).toBe("parar")
    expect(fpyBarEstado(0)).toBe("parar")
  })
})

describe("fpyBarHeightPercent (pure helper: FPY -> visible chart bar height)", () => {
  it("maps 100% FPY to the maximum bar height", () => {
    expect(fpyBarHeightPercent(100)).toBe(100)
  })

  it("maps 80% FPY (the bottom of the visible range) to the minimum bar height", () => {
    expect(fpyBarHeightPercent(80)).toBe(15)
  })

  it("clamps anything below 80% to the same minimum bar height (never an invisible bar)", () => {
    expect(fpyBarHeightPercent(0)).toBe(15)
    expect(fpyBarHeightPercent(79)).toBe(15)
  })

  it("clamps anything above 100% to the maximum bar height", () => {
    expect(fpyBarHeightPercent(105)).toBe(100)
  })

  it("scales linearly between the minimum and maximum for a mid-range value", () => {
    expect(fpyBarHeightPercent(90)).toBeCloseTo(57.5, 5)
  })
})

describe("barraFueraDeLimite (pure helper: is a metric value a limit breach, direction-aware, F2)", () => {
  it("flags a value above the limit as a breach when the direction is 'arriba' (torque, defects/h, scrap)", () => {
    expect(barraFueraDeLimite(12.5, 10, "arriba")).toBe(true)
    expect(barraFueraDeLimite(8, 10, "arriba")).toBe(false)
  })

  it("flags a value below the limit as a breach when the direction is 'abajo' (FPY)", () => {
    expect(barraFueraDeLimite(87.2, 92, "abajo")).toBe(true)
    expect(barraFueraDeLimite(95, 92, "abajo")).toBe(false)
  })

  it("does not flag a value exactly at the limit as a breach in either direction", () => {
    expect(barraFueraDeLimite(10, 10, "arriba")).toBe(false)
    expect(barraFueraDeLimite(92, 92, "abajo")).toBe(false)
  })
})

describe("heatmapBucket (pure helper: alert count -> heatmap bucket)", () => {
  it("returns '0' for zero alerts", () => {
    expect(heatmapBucket(0)).toBe("0")
  })

  it("returns '1-2' for 1 or 2 alerts", () => {
    expect(heatmapBucket(1)).toBe("1-2")
    expect(heatmapBucket(2)).toBe("1-2")
  })

  it("returns '3-5' for 3 to 5 alerts", () => {
    expect(heatmapBucket(3)).toBe("3-5")
    expect(heatmapBucket(5)).toBe("3-5")
  })

  it("returns '6+' for 6 or more alerts", () => {
    expect(heatmapBucket(6)).toBe("6+")
    expect(heatmapBucket(20)).toBe("6+")
  })

  it("rejects a negative count", () => {
    expect(() => heatmapBucket(-1)).toThrow()
  })
})

describe("mock data shape and invariants", () => {
  it("has exactly 5 KPI cards", () => {
    expect(KPIS).toHaveLength(5)
  })

  it("has a 30-day FPY trend", () => {
    expect(FPY_TENDENCIA.length).toBeGreaterThanOrEqual(28)
    for (const punto of FPY_TENDENCIA) {
      expect(punto.fpy).toBeGreaterThan(0)
      expect(punto.fpy).toBeLessThanOrEqual(100)
    }
  })

  it("mixes all three FPY threshold states across the 30-day trend (mirrors the mockup's blue/orange/red mix, not an almost-all-red trend)", () => {
    const estados = FPY_TENDENCIA.map((p) => fpyBarEstado(p.fpy))
    const contar = (estado: ReturnType<typeof fpyBarEstado>) => estados.filter((e) => e === estado).length
    expect(contar("ok")).toBeGreaterThanOrEqual(10)
    expect(contar("atencion")).toBeGreaterThanOrEqual(5)
    expect(contar("parar")).toBeGreaterThanOrEqual(5)
  })

  it("ends the FPY trend on a run of 'parar' days, like the mockup's declining tail", () => {
    const ultimos = FPY_TENDENCIA.slice(-3).map((p) => fpyBarEstado(p.fpy))
    expect(ultimos.every((e) => e === "parar")).toBe(true)
  })

  it("orders the named defect causes by descending count (the trailing 'Otros' catch-all is exempt)", () => {
    const nombradas = PARETO_DEFECTOS.filter((c) => c.causa !== "Otros")
    for (let i = 1; i < nombradas.length; i++) {
      expect(nombradas[i].cantidad).toBeLessThanOrEqual(nombradas[i - 1].cantidad)
    }
  })

  it("has cumulative percentage strictly increasing across the Pareto", () => {
    for (let i = 1; i < PARETO_DEFECTOS.length; i++) {
      expect(PARETO_DEFECTOS[i].porcentajeAcumulado).toBeGreaterThan(
        PARETO_DEFECTOS[i - 1].porcentajeAcumulado,
      )
    }
  })

  it("gives every alert its own metric metadata (title, unit, limit, direction) instead of a fixed torque label (F2)", () => {
    for (const a of ALERTAS) {
      expect(a.metrica.serie.length).toBeGreaterThan(0)
      expect(["arriba", "abajo"]).toContain(a.metrica.direccion)
      expect(a.metrica.titulo.length).toBeGreaterThan(0)
      expect(a.metrica.unidad.length).toBeGreaterThan(0)
    }
  })

  it("marks the FPY alert's breach direction as 'abajo' and the torque/defect/scrap alerts as 'arriba' (F2)", () => {
    expect(getAlertaPorId("fpy-por-debajo-l3-e4")!.metrica.direccion).toBe("abajo")
    expect(getAlertaPorId("torque-fuera-de-rango-l3-e7")!.metrica.direccion).toBe("arriba")
    expect(getAlertaPorId("defectos-por-hora-l3-e2")!.metrica.direccion).toBe("arriba")
    expect(getAlertaPorId("scrap-por-encima-l2-e3")!.metrica.direccion).toBe("arriba")
  })

  it("has at least one open alert with an ALTA severity", () => {
    expect(ALERTAS.some((a) => a.gravedad === "ALTA")).toBe(true)
  })

  it("looks up a known alert by id", () => {
    const primera = ALERTAS[0]
    expect(getAlertaPorId(primera.id)).toEqual(primera)
  })

  it("returns undefined for an unknown alert id", () => {
    expect(getAlertaPorId("no-existe")).toBeUndefined()
  })

  it("has exactly 5 reports, 3 of them scheduled", () => {
    expect(REPORTES).toHaveLength(5)
    expect(REPORTES.filter((r) => r.estado === "Programado")).toHaveLength(3)
  })
})

describe("reporteVariante (pure helper: report status -> badge variant)", () => {
  it("maps 'Programado' to the default (brand) variant", () => {
    expect(reporteVariante("Programado")).toBe("default")
  })

  it("maps 'Manual' to the secondary variant", () => {
    expect(reporteVariante("Manual")).toBe("secondary")
  })

  it("maps 'Pausado' to the outline variant", () => {
    expect(reporteVariante("Pausado")).toBe("outline")
  })
})
