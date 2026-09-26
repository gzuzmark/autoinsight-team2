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
    const vista = derivarVista(makeTablero({ alertas, nuevasIds: ["a2"], ultimaVisita: 1 }))
    expect(vista.cambiosDesdeUltimaVisita.map((a) => a.id)).toEqual(["a2"])
    expect(vista.totalNuevosDesdeVisita).toBe(1)
  })
})
