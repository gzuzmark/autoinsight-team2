import { describe, expect, it } from "vitest"
import { filasEstadoDemo } from "./tabla-estado-demo"
import type { EstadoDemo } from "@/lib/domain/floor-repository"

// J1 (queued batch J, 2026-09-29): pure row model behind the back-office
// "Estado de la demo" table (components/backoffice/backoffice-dashboard.tsx)
// -- one row per known line, with each KPI cell reduced to its own
// state/null (D3 "Sin datos") and the alert counts reduced to a per-severity
// breakdown, so the component only renders what this module computes.

function estadoDemo(overrides: Partial<EstadoDemo> = {}): EstadoDemo {
  return {
    lineas: [
      {
        nombre: "Línea 1 · Chasis",
        estadoKpi: "ok",
        indicadores: [
          { clave: "fpy", estado: "ok" },
          { clave: "dph", estado: "atencion" },
          { clave: "scrap", estado: "ok" },
        ],
        alertasPorSeveridad: { parar: 0, atencion: 1, ok: 0 },
        alertasAbiertas: 1,
        ultimaSimulacion: null,
      },
    ],
    participanteActual: 2,
    escenarioActivo: null,
    enviarReporteTurno: true,
    datosDisponibles: true,
    ...overrides,
  }
}

describe("filasEstadoDemo (J1)", () => {
  it("maps one row per line, with the overall and per-KPI states plus alert counts", () => {
    const filas = filasEstadoDemo(estadoDemo())
    expect(filas).toEqual([
      {
        nombre: "Línea 1 · Chasis",
        estado: { estado: "ok" },
        fpy: { estado: "ok" },
        defH: { estado: "atencion" },
        scrap: { estado: "ok" },
        alertas: {
          total: 1,
          porSeveridad: [{ severidad: "atencion", palabra: "MEDIA", cantidad: 1 }],
        },
      },
    ])
  })

  it("reports 'Sin alertas' shape (total 0, empty breakdown) when a line has no open alerts", () => {
    const filas = filasEstadoDemo(
      estadoDemo({
        lineas: [
          {
            nombre: "Línea 2 · Pintura",
            estadoKpi: "ok",
            indicadores: [
              { clave: "fpy", estado: "ok" },
              { clave: "dph", estado: "ok" },
              { clave: "scrap", estado: "ok" },
            ],
            alertasPorSeveridad: { parar: 0, atencion: 0, ok: 0 },
            alertasAbiertas: 0,
            ultimaSimulacion: null,
          },
        ],
      }),
    )
    expect(filas[0].alertas).toEqual({ total: 0, porSeveridad: [] })
  })

  it("orders multiple non-zero severities ALTA > MEDIA > BAJA, same order as the floor's own alert vocabulary", () => {
    const filas = filasEstadoDemo(
      estadoDemo({
        lineas: [
          {
            nombre: "Línea 3 · Motores",
            estadoKpi: "parar",
            indicadores: [
              { clave: "fpy", estado: "parar" },
              { clave: "dph", estado: "ok" },
              { clave: "scrap", estado: "ok" },
            ],
            alertasPorSeveridad: { parar: 1, atencion: 2, ok: 3 },
            alertasAbiertas: 6,
            ultimaSimulacion: 1_700_000_000_000,
          },
        ],
      }),
    )
    expect(filas[0].alertas).toEqual({
      total: 6,
      porSeveridad: [
        { severidad: "parar", palabra: "ALTA", cantidad: 1 },
        { severidad: "atencion", palabra: "MEDIA", cantidad: 2 },
        { severidad: "ok", palabra: "BAJA", cantidad: 3 },
      ],
    })
  })

  it("falls back to every cell as null ('Sin datos', D3) when datosDisponibles is false", () => {
    const filas = filasEstadoDemo(
      estadoDemo({
        datosDisponibles: false,
        lineas: [
          {
            nombre: "Línea 1 · Chasis",
            estadoKpi: "ok",
            indicadores: [],
            alertasPorSeveridad: { parar: 0, atencion: 0, ok: 0 },
            alertasAbiertas: 0,
            ultimaSimulacion: null,
          },
        ],
      }),
    )
    expect(filas).toEqual([
      { nombre: "Línea 1 · Chasis", estado: null, fpy: null, defH: null, scrap: null, alertas: null },
    ])
  })

  it("falls back a single KPI cell to null when that clave is missing from indicadores (never crashes)", () => {
    const filas = filasEstadoDemo(
      estadoDemo({
        lineas: [
          {
            nombre: "Línea 1 · Chasis",
            estadoKpi: "ok",
            indicadores: [{ clave: "fpy", estado: "ok" }],
            alertasPorSeveridad: { parar: 0, atencion: 0, ok: 0 },
            alertasAbiertas: 0,
            ultimaSimulacion: null,
          },
        ],
      }),
    )
    expect(filas[0].fpy).toEqual({ estado: "ok" })
    expect(filas[0].defH).toBeNull()
    expect(filas[0].scrap).toBeNull()
  })
})
