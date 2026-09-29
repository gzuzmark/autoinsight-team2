import { describe, expect, it } from "vitest"
import {
  descartarPendientes,
  ESTADO_INICIAL_NUEVAS_ALERTAS,
  procesarDescarteNuevasAlertas,
  registrarPoll,
  type EstadoNuevasAlertas,
} from "@/lib/domain/nuevas-alertas-poll"
import type { Alerta } from "@/lib/mock-data"

function alerta(id: string, timestamp = 0): Alerta {
  return { id, severidad: "atencion", titulo: `Alerta ${id}`, estacion: "Estación 1", timestamp, estado: "nueva" }
}

describe("registrarPoll", () => {
  it("learns the baseline on the first poll without reporting anything as new (D9 covers first load)", () => {
    const estado = registrarPoll(ESTADO_INICIAL_NUEVAS_ALERTAS, [alerta("a"), alerta("b")])
    expect(estado.pendientes).toEqual([])
    expect(estado.vistos).toEqual(new Set(["a", "b"]))
  })

  it("reports an alert id absent from the previous poll as new", () => {
    const primero = registrarPoll(ESTADO_INICIAL_NUEVAS_ALERTAS, [alerta("a")])
    const segundo = registrarPoll(primero, [alerta("a"), alerta("b", 100)])
    expect(segundo.pendientes.map((a) => a.id)).toEqual(["b"])
  })

  it("accumulates new alerts across multiple polls until dismissed", () => {
    let estado = registrarPoll(ESTADO_INICIAL_NUEVAS_ALERTAS, [alerta("a")])
    estado = registrarPoll(estado, [alerta("a"), alerta("b", 100)])
    estado = registrarPoll(estado, [alerta("a"), alerta("b", 100), alerta("c", 200)])
    expect(estado.pendientes.map((a) => a.id)).toEqual(["b", "c"])
  })

  it("does not re-report an id already seen, even if it left and came back", () => {
    let estado = registrarPoll(ESTADO_INICIAL_NUEVAS_ALERTAS, [alerta("a")])
    estado = registrarPoll(estado, []) // "a" resolved
    estado = descartarPendientes(estado)
    estado = registrarPoll(estado, [alerta("a")]) // reappears (e.g. re-simulated) -- id already known
    expect(estado.pendientes).toEqual([])
  })

  it("a poll with no new ids leaves pendientes untouched", () => {
    let estado = registrarPoll(ESTADO_INICIAL_NUEVAS_ALERTAS, [alerta("a")])
    estado = registrarPoll(estado, [alerta("a"), alerta("b", 100)])
    const antes = estado.pendientes
    estado = registrarPoll(estado, [alerta("a"), alerta("b", 100)])
    expect(estado.pendientes).toBe(antes)
  })
})

describe("descartarPendientes", () => {
  it("clears the accumulated batch without touching vistos", () => {
    let estado = registrarPoll(ESTADO_INICIAL_NUEVAS_ALERTAS, [alerta("a")])
    estado = registrarPoll(estado, [alerta("a"), alerta("b", 100)])
    const vistosAntes = estado.vistos
    const limpio = descartarPendientes(estado)
    expect(limpio.pendientes).toEqual([])
    expect(limpio.vistos).toBe(vistosAntes)
  })

  it("is a no-op on an already-empty batch", () => {
    const estado: EstadoNuevasAlertas = { vistos: new Set(["a"]), pendientes: [] }
    expect(descartarPendientes(estado)).toBe(estado)
  })
})

describe("procesarDescarteNuevasAlertas (K-1: pure decision, called exactly once by the caller)", () => {
  it("returns the cleared state and the pending count to capture when there is a participant and pending alerts", () => {
    let estado = registrarPoll(ESTADO_INICIAL_NUEVAS_ALERTAS, [alerta("a")])
    estado = registrarPoll(estado, [alerta("a"), alerta("b", 100)])
    const resultado = procesarDescarteNuevasAlertas(estado, "P3")
    expect(resultado.cantidad).toBe(1)
    expect(resultado.estado.pendientes).toEqual([])
  })

  it("returns cantidad null (no capture) when there is no identified participant yet", () => {
    let estado = registrarPoll(ESTADO_INICIAL_NUEVAS_ALERTAS, [alerta("a")])
    estado = registrarPoll(estado, [alerta("a"), alerta("b", 100)])
    const resultado = procesarDescarteNuevasAlertas(estado, null)
    expect(resultado.cantidad).toBeNull()
    expect(resultado.estado.pendientes).toEqual([])
  })

  it("returns cantidad null (no-op capture) when the batch is already empty", () => {
    const estado: EstadoNuevasAlertas = { vistos: new Set(["a"]), pendientes: [] }
    const resultado = procesarDescarteNuevasAlertas(estado, "P3")
    expect(resultado.cantidad).toBeNull()
    expect(resultado.estado).toBe(estado)
  })

  it("is a pure function: calling it twice with the same input never changes the reported cantidad (proves a caller invoking it more than once, e.g. React StrictMode re-running a handler, cannot double-count)", () => {
    let estado = registrarPoll(ESTADO_INICIAL_NUEVAS_ALERTAS, [alerta("a")])
    estado = registrarPoll(estado, [alerta("a"), alerta("b", 100)])
    const primera = procesarDescarteNuevasAlertas(estado, "P3")
    const segunda = procesarDescarteNuevasAlertas(estado, "P3")
    expect(primera.cantidad).toBe(segunda.cantidad)
    expect(primera.cantidad).toBe(1)
  })

  it("L-1: derives its next estado entirely from the `estado` argument, so applying it as a React functional setState updater on top of a poll queued in the same batch never loses that poll's additions", () => {
    // Simulates the exact race the L-1 fix protects against: a poll (via
    // aplicarTablero's own functional setState) and a dismiss click land in
    // the same React batch. React applies queued updates for one state
    // variable in order, so the dismiss's functional updater must run
    // against the poll's OUTPUT (`conPollEncolado`), never against an
    // earlier snapshot captured before the poll was processed.
    let estado = registrarPoll(ESTADO_INICIAL_NUEVAS_ALERTAS, [alerta("a")])
    estado = registrarPoll(estado, [alerta("a"), alerta("b", 100)]) // rendered: pendientes = [b]

    // A poll that lands in the SAME batch as the dismiss -- not yet
    // reflected in any ref/snapshot the caller may have read before this
    // batch started.
    const conPollEncolado = registrarPoll(estado, [alerta("a"), alerta("b", 100), alerta("c", 200)])

    // The fix: apply the dismiss reducer to the queued poll's OUTPUT (what
    // React hands a functional updater), not to `estado` (a pre-batch
    // snapshot).
    const resultado = procesarDescarteNuevasAlertas(conPollEncolado, "P3")

    expect(resultado.estado.pendientes).toEqual([])
    // The poll's vistos additions ("c") survive the dismiss.
    expect(resultado.estado.vistos).toEqual(new Set(["a", "b", "c"]))

    // A later poll must not re-report "c" as new -- proving it was really
    // folded into `vistos`, not just absent from `pendientes` by accident.
    const siguientePoll = registrarPoll(resultado.estado, [alerta("a"), alerta("b", 100), alerta("c", 200)])
    expect(siguientePoll.pendientes).toEqual([])
  })
})
