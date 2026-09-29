import { describe, expect, it } from "vitest"
import { formatearResumenAlertas } from "./resumen-alertas"

describe("formatearResumenAlertas (H3)", () => {
  it("returns 'Sin alertas' when every severity is 0", () => {
    expect(formatearResumenAlertas({ parar: 0, atencion: 0, ok: 0 })).toBe("Sin alertas")
  })

  it("shows the total plus a non-zero severity, e.g. '4 alertas · 2 ALTA'", () => {
    expect(formatearResumenAlertas({ parar: 2, atencion: 0, ok: 0 })).toBe("2 alertas · 2 ALTA")
  })

  it("includes every non-zero severity, in ALTA/MEDIA/BAJA order, compactly", () => {
    expect(formatearResumenAlertas({ parar: 2, atencion: 2, ok: 0 })).toBe("4 alertas · 2 ALTA · 2 MEDIA")
    expect(formatearResumenAlertas({ parar: 0, atencion: 1, ok: 3 })).toBe("4 alertas · 1 MEDIA · 3 BAJA")
    expect(formatearResumenAlertas({ parar: 1, atencion: 1, ok: 1 })).toBe("3 alertas · 1 ALTA · 1 MEDIA · 1 BAJA")
  })
})
