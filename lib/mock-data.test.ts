import { describe, expect, it } from "vitest"
import { formatearHora } from "@/lib/mock-data"

describe("formatearHora", () => {
  it("formats in the device's local time zone as 24h HH:MM", () => {
    // Local-time constructor: 02:12 on the device, whatever its time zone is.
    const ts = new Date(2026, 8, 25, 2, 12).getTime()
    expect(formatearHora(ts)).toBe("02:12")
  })

  it("uses 24h format in the afternoon", () => {
    const ts = new Date(2026, 8, 25, 14, 5).getTime()
    expect(formatearHora(ts)).toBe("14:05")
  })
})
