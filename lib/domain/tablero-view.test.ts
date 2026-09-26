import { describe, expect, it } from "vitest"
import { derivarVista } from "@/lib/domain/tablero-view"
import type { Tablero } from "@/lib/domain/floor-repository"
import type { Alerta } from "@/lib/mock-data"

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

function makeTablero(overrides: Partial<Tablero>): Tablero {
  return {
    planta: { nombre: "Planta Norte" },
    linea: { nombre: "Línea 3", turno: "Turno mañana" },
    usuario: { id: "u1", nombre: "Ana", iniciales: "AR", color: "#000" },
    indicadores: [],
    alertas: [],
    ultimaActualizacion: 0,
    ultimaVisita: null,
    nuevasIds: [],
    cambiosDesdeVisita: 0,
    ...overrides,
  }
}

describe("derivarVista", () => {
  it("returns an empty/first-visit view when tablero is null (not yet loaded)", () => {
    const vista = derivarVista(null)
    expect(vista.alertasActivas).toEqual([])
    expect(vista.cambiosDesdeUltimaVisita).toEqual([])
    expect(vista.totalNuevosDesdeVisita).toBe(0)
    expect(vista.esPrimeraVisita).toBe(true)
    expect(vista.ultimoLogoutTs).toBeNull()
  })

  it("reports first visit when ultimaVisita is null", () => {
    const vista = derivarVista(makeTablero({ ultimaVisita: null }))
    expect(vista.esPrimeraVisita).toBe(true)
    expect(vista.ultimoLogoutTs).toBeNull()
  })

  it("reports a returning visit with ultimoLogoutTs from ultimaVisita", () => {
    const vista = derivarVista(makeTablero({ ultimaVisita: 12345 }))
    expect(vista.esPrimeraVisita).toBe(false)
    expect(vista.ultimoLogoutTs).toBe(12345)
  })

  it("exposes alertas as alertasActivas", () => {
    const alertas = [makeAlert({ id: "a1" }), makeAlert({ id: "a2" })]
    const vista = derivarVista(makeTablero({ alertas }))
    expect(vista.alertasActivas).toEqual(alertas)
  })

  it("derives cambiosDesdeUltimaVisita from nuevasIds intersected with alertas", () => {
    const alertas = [makeAlert({ id: "a1" }), makeAlert({ id: "a2" })]
    const vista = derivarVista(
      makeTablero({ alertas, nuevasIds: ["a2"], ultimaVisita: 1, cambiosDesdeVisita: 1 }),
    )
    expect(vista.cambiosDesdeUltimaVisita.map((a) => a.id)).toEqual(["a2"])
    expect(vista.totalNuevosDesdeVisita).toBe(1)
  })

  // K2: the four cases the since-last-visit strip distinguishes (see
  // components/since-last-visit.tsx), driven entirely by
  // esPrimeraVisita/totalNuevosDesdeVisita/cambiosDesdeUltimaVisita.
  describe("the four since-last-visit cases (K2)", () => {
    it("case 1: first visit -> esPrimeraVisita true, hidden regardless of counts", () => {
      const vista = derivarVista(makeTablero({ ultimaVisita: null, cambiosDesdeVisita: 0 }))
      expect(vista.esPrimeraVisita).toBe(true)
    })

    it("case 2: nothing changed since the last visit -> totalNuevosDesdeVisita 0, no active changes", () => {
      const vista = derivarVista(
        makeTablero({ ultimaVisita: 1, cambiosDesdeVisita: 0, nuevasIds: [], alertas: [] }),
      )
      expect(vista.esPrimeraVisita).toBe(false)
      expect(vista.totalNuevosDesdeVisita).toBe(0)
      expect(vista.cambiosDesdeUltimaVisita).toEqual([])
    })

    it("case 3 (K2 regression, F1): every new alert was already resolved -> totalNuevosDesdeVisita stays > 0 even though no active alert is new", () => {
      // The 3 alerts created since the last visit are no longer active (all
      // resolved), so they are absent from `alertas` and `nuevasIds`
      // (both server adapters only report currently-active alerts there).
      // Before K2, totalNuevosDesdeVisita came from nuevasIds.size and would
      // wrongly read 0 here, making the strip claim "Sin cambios" (false).
      const vista = derivarVista(
        makeTablero({ ultimaVisita: 1, cambiosDesdeVisita: 3, nuevasIds: [], alertas: [] }),
      )
      expect(vista.totalNuevosDesdeVisita).toBe(3)
      expect(vista.cambiosDesdeUltimaVisita).toEqual([])
    })

    it("case 4: some new alerts are still active -> per-station lines have data to show", () => {
      const alertas = [makeAlert({ id: "a1" }), makeAlert({ id: "a2" })]
      const vista = derivarVista(
        makeTablero({ ultimaVisita: 1, cambiosDesdeVisita: 2, nuevasIds: ["a2"], alertas }),
      )
      expect(vista.totalNuevosDesdeVisita).toBe(2)
      expect(vista.cambiosDesdeUltimaVisita.map((a) => a.id)).toEqual(["a2"])
    })
  })
})
