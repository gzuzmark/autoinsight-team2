import { describe, expect, it } from "vitest"
import {
  ESTADO_INICIAL_ULTIMA_ACTUALIZACION,
  registrarPollExitoso,
} from "@/lib/domain/ultima-actualizacion-poll"

describe("registrarPollExitoso (Batch I: D6/D29 header shows last successful poll, not last data change)", () => {
  it("starts with no successful poll recorded", () => {
    expect(ESTADO_INICIAL_ULTIMA_ACTUALIZACION.ultimoPollExitoso).toBeNull()
  })

  it("records the given timestamp as the last successful poll", () => {
    const estado = registrarPollExitoso(ESTADO_INICIAL_ULTIMA_ACTUALIZACION, 1000)
    expect(estado.ultimoPollExitoso).toBe(1000)
  })

  it("a later poll replaces the earlier timestamp", () => {
    const primero = registrarPollExitoso(ESTADO_INICIAL_ULTIMA_ACTUALIZACION, 1000)
    const segundo = registrarPollExitoso(primero, 2000)
    expect(segundo.ultimoPollExitoso).toBe(2000)
  })

  it("is pure: does not mutate the input state", () => {
    const estado = ESTADO_INICIAL_ULTIMA_ACTUALIZACION
    registrarPollExitoso(estado, 1000)
    expect(estado.ultimoPollExitoso).toBeNull()
  })
})
