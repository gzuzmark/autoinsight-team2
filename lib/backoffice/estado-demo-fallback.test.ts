import { describe, expect, it } from "vitest"
import { LINEAS_DEMO_CONOCIDAS, type EstadoDemo } from "@/lib/domain/floor-repository"
import { resolverEstadoDemo } from "@/lib/backoffice/estado-demo-fallback"

describe("resolverEstadoDemo (C4, RDD review G2)", () => {
  it("passes through the real EstadoDemo and no error on success", () => {
    const real: EstadoDemo = {
      lineas: LINEAS_DEMO_CONOCIDAS.map((nombre) => ({
        nombre,
        estadoKpi: "ok",
        indicadores: [
          { clave: "fpy", estado: "ok" },
          { clave: "dph", estado: "ok" },
          { clave: "scrap", estado: "ok" },
        ],
        alertasPorSeveridad: { parar: 0, atencion: 0, ok: 0 },
        alertasAbiertas: 0,
        ultimaSimulacion: null,
      })),
      escenarioActivo: null,
      enviarReporteTurno: true,
      participanteActual: 3,
      datosDisponibles: true,
    }
    const resultado = resolverEstadoDemo({ ok: true, data: real })
    expect(resultado.estadoDemo).toBe(real)
    expect(resultado.error).toBeNull()
  })

  it("falls back to a usable placeholder (one row per known line) and surfaces the error on failure", () => {
    const resultado = resolverEstadoDemo({ ok: false, error: "boom" })
    expect(resultado.error).toBe("boom")
    expect(resultado.estadoDemo.lineas.map((l) => l.nombre).sort()).toEqual([...LINEAS_DEMO_CONOCIDAS].sort())
    expect(resultado.estadoDemo.escenarioActivo).toBeNull()
    for (const linea of resultado.estadoDemo.lineas) {
      expect(linea.ultimaSimulacion).toBeNull()
    }
  })

  // D3 (final-demo plan Batch I, RDD review G3 follow-up R3-fallback-reports-ok):
  // the fallback must never claim a healthy plant ("ok"/0 alerts) during an
  // outage -- only the inline error banner said otherwise before, and
  // nothing pinned that down. `datosDisponibles: false` is the one signal
  // the dashboard needs to render an explicit "Sin datos" neutral chip
  // instead of a real KPI/alert state (see backoffice-dashboard.tsx).
  it("D3: reports datosDisponibles false on failure -- never a fabricated healthy state", () => {
    const resultado = resolverEstadoDemo({ ok: false, error: "boom" })
    expect(resultado.estadoDemo.datosDisponibles).toBe(false)
  })
})
