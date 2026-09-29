import { describe, expect, it } from "vitest"
import {
  ESTADO_INICIAL_TIMING,
  msDesdeAbierta,
  msDesdeMostrada,
  registrarAbierta,
  registrarMostradas,
} from "@/lib/analytics/alerta-timing"

/**
 * G8: pure, unit-tested session-scoped alert-timing tracker feeding
 * eventoAlertaMostrada/Abierta/Resuelta's ms_desde_* fields. Mirrors the
 * existing lib/domain/nuevas-alertas-poll.ts pattern (explicit
 * state-in/state-out reducers, no class, no hidden mutation) so it is
 * trivially testable and swappable in components/app-provider.tsx.
 */

describe("registrarMostradas", () => {
  it("reports every id as new the first time it is seen", () => {
    const { estado, nuevas } = registrarMostradas(ESTADO_INICIAL_TIMING, ["a1", "a2"], 1000)
    expect(nuevas).toEqual(["a1", "a2"])
    expect(msDesdeMostrada(estado, "a1", 1500)).toBe(500)
  })

  it("does not re-report an id already seen in an earlier call", () => {
    const primero = registrarMostradas(ESTADO_INICIAL_TIMING, ["a1"], 1000)
    const segundo = registrarMostradas(primero.estado, ["a1", "a2"], 2000)
    expect(segundo.nuevas).toEqual(["a2"])
    // a1's mostradaEn timestamp is unchanged by the second poll.
    expect(msDesdeMostrada(segundo.estado, "a1", 3000)).toBe(2000)
  })
})

describe("registrarAbierta / msDesdeAbierta", () => {
  it("records when an alert was opened and computes ms since", () => {
    const { estado: vista } = registrarMostradas(ESTADO_INICIAL_TIMING, ["a1"], 1000)
    const abierta = registrarAbierta(vista, "a1", 1500)
    expect(msDesdeAbierta(abierta, "a1", 3000)).toBe(1500)
  })

  it("msDesdeAbierta is null for an alert never opened", () => {
    expect(msDesdeAbierta(ESTADO_INICIAL_TIMING, "unknown", 1000)).toBeNull()
  })
})

describe("msDesdeMostrada", () => {
  it("is null for an alert never recorded as shown", () => {
    expect(msDesdeMostrada(ESTADO_INICIAL_TIMING, "unknown", 1000)).toBeNull()
  })
})
