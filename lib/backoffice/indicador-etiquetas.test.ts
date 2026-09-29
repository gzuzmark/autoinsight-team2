import { describe, expect, it } from "vitest"
import { etiquetaIndicador } from "@/lib/backoffice/indicador-etiquetas"

describe("etiquetaIndicador (Batch I: per-line KPI chips)", () => {
  it("maps known KPI keys to their short back-office label", () => {
    expect(etiquetaIndicador("fpy")).toBe("FPY")
    expect(etiquetaIndicador("dph")).toBe("Defectos/h")
    expect(etiquetaIndicador("scrap")).toBe("Scrap")
  })

  it("falls back to the raw clave for an unknown key instead of throwing", () => {
    expect(etiquetaIndicador("otro")).toBe("otro")
  })
})
