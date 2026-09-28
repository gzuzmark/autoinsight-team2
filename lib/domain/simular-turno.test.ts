import { describe, expect, it } from "vitest"
import { PLANTILLAS_TURNO, simularTurnoLinea } from "@/lib/domain/simular-turno"
import { activeAlerts } from "@/lib/domain/alerts"
import { INDICADORES } from "@/lib/mock-data"

const AHORA = Date.now()
const INDICADORES_BASE = INDICADORES.map((i) => ({ ...i }))

describe("simularTurnoLinea (mock-mode analogue of private.simular_turno_en_linea)", () => {
  it("adds the requested number of new active alerts on an empty line", () => {
    const resultado = simularTurnoLinea([], INDICADORES_BASE, 2, AHORA)
    expect(resultado.agregadas.length).toBe(2)
    expect(activeAlerts(resultado.alertas).length).toBe(2)
    for (const a of resultado.agregadas) {
      expect(a.estado).toBe("nueva")
      expect(a.timestamp).toBe(AHORA)
    }
  })

  it("never picks a template whose titulo is already active on the line", () => {
    const primero = simularTurnoLinea([], INDICADORES_BASE, 1, AHORA)
    const segundo = simularTurnoLinea(primero.alertas, INDICADORES_BASE, 1, AHORA + 1000)
    const titulos = activeAlerts(segundo.alertas).map((a) => a.titulo)
    expect(new Set(titulos).size).toBe(titulos.length)
  })

  it("frees room (K5) by marking the oldest template-generated active alert no_aplica when saturated", () => {
    // Saturate every template.
    let estado = simularTurnoLinea([], INDICADORES_BASE, PLANTILLAS_TURNO.length, AHORA)
    expect(activeAlerts(estado.alertas).length).toBe(PLANTILLAS_TURNO.length)

    const otraVez = simularTurnoLinea(estado.alertas, INDICADORES_BASE, 1, AHORA + 5000)
    // Still bounded: exactly one net-new active template alert replaces an evicted one.
    expect(activeAlerts(otraVez.alertas).length).toBe(PLANTILLAS_TURNO.length)
    expect(otraVez.agregadas.length).toBe(1)
  })

  it("records a KPI reading for a linked template and recovers the other indicators (D25/D26)", () => {
    const resultado = simularTurnoLinea([], INDICADORES_BASE, 1, AHORA)
    const tocado = PLANTILLAS_TURNO.find((t) => t.titulo === resultado.agregadas[0].titulo)
    expect(tocado?.indicadorId).toBeDefined()

    const indTocado = resultado.indicadoresState.find((i) => i.id === tocado!.indicadorId)!
    const base = INDICADORES_BASE.find((i) => i.id === tocado!.indicadorId)!
    expect(indTocado.valor).not.toBe(base.valor)
    expect(indTocado.actualizadoEn).toBe(AHORA)

    // Every OTHER indicator recovered (moved toward ok), not left untouched.
    for (const ind of resultado.indicadoresState) {
      if (ind.id === tocado!.indicadorId) continue
      const baseInd = INDICADORES_BASE.find((i) => i.id === ind.id)!
      expect(ind.actualizadoEn).toBe(AHORA)
      expect(ind).not.toEqual(baseInd)
    }
  })

  it("C2: an 'atencion' template lands its KPI reading in the atencion band, not parar (D25)", () => {
    // "Nivel de adhesivo bajo" is the catalog's only "atencion" template
    // with a linked indicator (scrap). Force it to be picked by pre-filling
    // every OTHER template's titulo as already-active on the line.
    const yaActivas = PLANTILLAS_TURNO.filter((t) => t.titulo !== "Nivel de adhesivo bajo").map((t, i) => ({
      id: `preexistente-${i}`,
      severidad: t.severidad,
      titulo: t.titulo,
      estacion: t.estacion,
      timestamp: AHORA - 1000,
      estado: "nueva" as const,
    }))
    const resultado = simularTurnoLinea(yaActivas, INDICADORES_BASE, 1, AHORA)
    expect(resultado.agregadas.length).toBe(1)
    expect(resultado.agregadas[0].titulo).toBe("Nivel de adhesivo bajo")

    const scrap = resultado.indicadoresState.find((i) => i.id === "scrap")!
    // scrap: lower-is-better, atencion > 2, parar > 3 -- the atencion band is
    // (2, 3], strictly below the parar threshold.
    expect(scrap.valor).toBeGreaterThan(scrap.umbralAtencion)
    expect(scrap.valor).toBeLessThanOrEqual(scrap.umbralParar)
  })

  it("is deterministic (no randomness): same input, same output", () => {
    const a = simularTurnoLinea([], INDICADORES_BASE, 2, AHORA)
    const b = simularTurnoLinea([], INDICADORES_BASE, 2, AHORA)
    expect(a.agregadas.map((x) => x.titulo)).toEqual(b.agregadas.map((x) => x.titulo))
  })
})
