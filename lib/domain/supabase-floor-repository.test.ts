import { describe, expect, it, vi } from "vitest"

/**
 * E1 (RDD review hotfix follow-up): `simularTurno`'s post-RPC reads (lineas
 * lookup, indicadores select, alertas count) enrich the shift-report email
 * but run AFTER `demo_simular_turno_linea` has already committed the shift.
 * A failure in any of them must degrade the returned report data instead of
 * throwing -- the shift already happened, so the caller (`POST
 * /api/backoffice/turno`) must still get a resolved result, never a
 * rejection that turns into a 500 for a shift that did happen.
 *
 * This is a unit test (not the real-stack integration test): it mocks
 * `@supabase/supabase-js`'s `createClient` so the RPC succeeds but the
 * follow-up `.from("lineas")` read fails.
 */

function makeBuilder(result: { data: unknown; error: unknown; count?: number | null }) {
  const builder: {
    select: (...args: unknown[]) => typeof builder
    eq: (...args: unknown[]) => typeof builder
    single: () => Promise<{ data: unknown; error: unknown }>
    then: (
      onFulfilled: (value: { data: unknown; error: unknown; count?: number | null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise<unknown>
  } = {
    select: () => builder,
    eq: () => builder,
    single: () => Promise.resolve({ data: result.data, error: result.error }),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  return builder
}

const rpc = vi.fn()
const from = vi.fn()

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: (...args: unknown[]) => rpc(...args), from: (...args: unknown[]) => from(...args) }),
}))

describe("SupabaseFloorRepository#simularTurno (E1)", () => {
  it("degrades report data instead of throwing when a post-RPC read fails", async () => {
    const { SupabaseFloorRepository } = await import("@/lib/domain/supabase-floor-repository")
    const repo = new SupabaseFloorRepository("https://x.test", "secret")

    rpc.mockResolvedValueOnce({
      data: [{ id: "a1", severidad: "media", titulo: "Alerta X", creada_en: "2026-09-29T00:00:00.000Z" }],
      error: null,
    })
    from.mockImplementation((table: string) => {
      if (table === "lineas") return makeBuilder({ data: null, error: { message: "boom", code: "XX000" } })
      throw new Error("should not be reached once the lineas lookup fails")
    })

    const reporte = await repo.simularTurno("Línea 3 · Motores")

    expect(reporte.linea).toBe("Línea 3 · Motores")
    // The RPC already committed the shift and returned its own alerts --
    // those must survive even when the enrichment reads fail.
    expect(reporte.nuevasAlertas).toHaveLength(1)
    expect(reporte.datosDisponibles).toBe(false)
    expect(reporte.indicadores).toEqual([])
    expect(reporte.alertasAbiertas).toBe(0)
  })
})

describe("SupabaseFloorRepository#estadoDemo (Batch I: per-line KPI chips)", () => {
  it("maps the new per-KPI indicadores field and reports datosDisponibles true", async () => {
    const { SupabaseFloorRepository } = await import("@/lib/domain/supabase-floor-repository")
    const repo = new SupabaseFloorRepository("https://x.test", "secret")

    rpc.mockImplementation((fn: string) => {
      if (fn === "demo_estado_lineas") {
        return Promise.resolve({
          data: [
            {
              nombre: "Línea 3 · Motores",
              estado_kpi: "parar",
              alertas_abiertas: 1,
              alertas_alta: 1,
              alertas_media: 0,
              alertas_baja: 0,
              ultima_simulacion: null,
              indicadores: [
                { clave: "fpy", estado: "parar" },
                { clave: "dph", estado: "ok" },
                { clave: "scrap", estado: "ok" },
              ],
            },
          ],
          error: null,
        })
      }
      if (fn === "demo_estado_activo") return Promise.resolve({ data: null, error: null })
      if (fn === "demo_enviar_reporte_turno") return Promise.resolve({ data: true, error: null })
      if (fn === "demo_participante_actual") return Promise.resolve({ data: 3, error: null })
      throw new Error(`unexpected rpc: ${fn}`)
    })

    const estado = await repo.estadoDemo()

    expect(estado.datosDisponibles).toBe(true)
    expect(estado.participanteActual).toBe(3)
    const linea = estado.lineas.find((l) => l.nombre === "Línea 3 · Motores")!
    expect(linea.indicadores).toEqual([
      { clave: "fpy", estado: "parar" },
      { clave: "dph", estado: "ok" },
      { clave: "scrap", estado: "ok" },
    ])
  })
})

describe("SupabaseFloorRepository#tablero (G8: participant field)", () => {
  it("includes the participant number read alongside the tablero RPC", async () => {
    const { SupabaseFloorRepository } = await import("@/lib/domain/supabase-floor-repository")
    const repo = new SupabaseFloorRepository("https://x.test", "secret")

    rpc.mockImplementation((fn: string) => {
      if (fn === "tablero") {
        return Promise.resolve({
          data: {
            planta: { nombre: "Planta Norte" },
            linea: { nombre: "Línea 3 · Motores", turno: "Turno mañana" },
            usuario: { id: "u1", nombre: "Ana Ríos", iniciales: "AR", color: "#000" },
            indicadores: [],
            alertas: [],
            ultima_visita: null,
            nuevas_ids: [],
            cambios_desde_visita: 0,
            ultima_actualizacion: "2026-09-29T00:00:00.000Z",
          },
          error: null,
        })
      }
      if (fn === "demo_participante_actual") return Promise.resolve({ data: 4, error: null })
      throw new Error(`unexpected rpc: ${fn}`)
    })

    const tablero = await repo.tablero("session-1")
    expect(tablero.participante).toBe(4)
  })

  it("degrades to 1 when the participant read fails, without failing the tablero fetch", async () => {
    const { SupabaseFloorRepository } = await import("@/lib/domain/supabase-floor-repository")
    const repo = new SupabaseFloorRepository("https://x.test", "secret")

    rpc.mockImplementation((fn: string) => {
      if (fn === "tablero") {
        return Promise.resolve({
          data: {
            planta: { nombre: "Planta Norte" },
            linea: { nombre: "Línea 3 · Motores", turno: "Turno mañana" },
            usuario: { id: "u1", nombre: "Ana Ríos", iniciales: "AR", color: "#000" },
            indicadores: [],
            alertas: [],
            ultima_visita: null,
            nuevas_ids: [],
            cambios_desde_visita: 0,
            ultima_actualizacion: "2026-09-29T00:00:00.000Z",
          },
          error: null,
        })
      }
      if (fn === "demo_participante_actual") return Promise.resolve({ data: null, error: { message: "boom" } })
      throw new Error(`unexpected rpc: ${fn}`)
    })

    const tablero = await repo.tablero("session-1")
    expect(tablero.participante).toBe(1)
  })
})
