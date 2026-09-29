import { describe, expect, it } from "vitest"
import {
  contarNoLeidas,
  esNoLeida,
  etiquetaContador,
  marcarLeida,
  marcarTodasLeidas,
} from "@/lib/oficina/notificaciones"
import type { NotificacionAlerta } from "@/lib/domain/floor-repository"

function notificacion(id: string, creadaEn = 0): NotificacionAlerta {
  return { id, titulo: `Alerta ${id}`, severidad: "parar", linea: "Línea 3 · Motores", estacion: "Estación 1", creadaEn }
}

describe("esNoLeida", () => {
  it("is unread when the id is not in the read set", () => {
    expect(esNoLeida(notificacion("a"), new Set())).toBe(true)
  })

  it("is read when the id is in the read set", () => {
    expect(esNoLeida(notificacion("a"), new Set(["a"]))).toBe(false)
  })
})

describe("contarNoLeidas", () => {
  it("counts notifications whose id is not in the read set", () => {
    const notificaciones = [notificacion("a"), notificacion("b"), notificacion("c")]
    expect(contarNoLeidas(notificaciones, new Set(["b"]))).toBe(2)
  })

  it("is 0 when every notification is read", () => {
    const notificaciones = [notificacion("a"), notificacion("b")]
    expect(contarNoLeidas(notificaciones, new Set(["a", "b"]))).toBe(0)
  })

  it("is 0 for an empty list", () => {
    expect(contarNoLeidas([], new Set())).toBe(0)
  })
})

describe("marcarLeida", () => {
  it("returns a new set with the id added, without mutating the input", () => {
    const original = new Set(["a"])
    const resultado = marcarLeida(original, "b")
    expect(resultado).toEqual(new Set(["a", "b"]))
    expect(original).toEqual(new Set(["a"]))
  })

  it("is idempotent for an already-read id", () => {
    const resultado = marcarLeida(new Set(["a"]), "a")
    expect(resultado).toEqual(new Set(["a"]))
  })
})

describe("marcarTodasLeidas", () => {
  it("returns a set containing every notification id, merged with what was already read", () => {
    const notificaciones = [notificacion("a"), notificacion("b")]
    const resultado = marcarTodasLeidas(notificaciones, new Set(["z"]))
    expect(resultado).toEqual(new Set(["a", "b", "z"]))
  })

  it("does not mutate the input set", () => {
    const original = new Set(["z"])
    marcarTodasLeidas([notificacion("a")], original)
    expect(original).toEqual(new Set(["z"]))
  })
})

describe("etiquetaContador (unread badge: hidden at 0, capped at '9+')", () => {
  it("is null (hidden) at 0", () => {
    expect(etiquetaContador(0)).toBeNull()
  })

  it("shows the exact count under 10", () => {
    expect(etiquetaContador(1)).toBe("1")
    expect(etiquetaContador(9)).toBe("9")
  })

  it("caps at '9+' from 10 up", () => {
    expect(etiquetaContador(10)).toBe("9+")
    expect(etiquetaContador(42)).toBe("9+")
  })
})
