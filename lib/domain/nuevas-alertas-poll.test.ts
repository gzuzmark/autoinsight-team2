import { describe, expect, it } from "vitest"
import {
  descartarPendientes,
  ESTADO_INICIAL_NUEVAS_ALERTAS,
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
