import { describe, expect, it } from "vitest"
import { idParticipante, participanteIdParaIdentificar } from "@/lib/analytics/identify-on-change"

/**
 * G8: pure decision behind re-identifying with PostHog whenever the
 * participant number changes mid-session (a facilitator "Nuevo
 * participante" while someone else's tablero is still polling) --
 * components/app-provider.tsx calls this on every successful tablero
 * fetch instead of unconditionally calling posthog.identify (which would
 * be harmless but noisy/untestable inline).
 */

describe("idParticipante", () => {
  it("formats the participant number as 'P<n>'", () => {
    expect(idParticipante(3)).toBe("P3")
  })
})

describe("participanteIdParaIdentificar", () => {
  it("returns the new id the first time (no previous id)", () => {
    expect(participanteIdParaIdentificar(null, 3)).toBe("P3")
  })

  it("returns null when the participant number has not changed", () => {
    expect(participanteIdParaIdentificar("P3", 3)).toBeNull()
  })

  it("returns the new id when the participant number changed", () => {
    expect(participanteIdParaIdentificar("P3", 4)).toBe("P4")
  })
})
