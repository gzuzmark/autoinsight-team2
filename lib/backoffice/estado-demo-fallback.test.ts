import { describe, expect, it } from "vitest"
import { LINEAS_DEMO_CONOCIDAS, type EstadoDemo } from "@/lib/domain/floor-repository"
import { resolverEstadoDemo } from "@/lib/backoffice/estado-demo-fallback"

describe("resolverEstadoDemo (C4, RDD review G2)", () => {
  it("passes through the real EstadoDemo and no error on success", () => {
    const real: EstadoDemo = {
      lineas: LINEAS_DEMO_CONOCIDAS.map((nombre) => ({
        nombre,
        estado: "ok",
        alertasAbiertas: 0,
        ultimaSimulacion: null,
      })),
      escenarioActivo: null,
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
    // Every line reports "unknown" honestly (0 open alerts / ok is a lie we
    // must not fabricate) -- see the module doc for why alertasAbiertas is
    // deliberately 0 here rather than an invented larger number.
    for (const linea of resultado.estadoDemo.lineas) {
      expect(linea.ultimaSimulacion).toBeNull()
    }
  })
})
