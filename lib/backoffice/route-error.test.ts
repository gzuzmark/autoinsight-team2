import { describe, expect, it, vi } from "vitest"
import { respuestaErrorInterno } from "@/lib/backoffice/route-error"

describe("respuestaErrorInterno (D5, final-demo plan Batch I)", () => {
  it("returns a JSON error body with no-store and status 500", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const res = respuestaErrorInterno("aplicarEscenario", new Error("boom"))
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(res.headers.get("cache-control")).toBe("no-store")
      expect(typeof body.error).toBe("string")
      expect(body.error.length).toBeGreaterThan(0)
    } finally {
      consoleSpy.mockRestore()
    }
  })

  it("logs the underlying error server-side with the given context", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const err = new Error("boom")
      respuestaErrorInterno("reiniciarDemo", err)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("reiniciarDemo"), err)
    } finally {
      consoleSpy.mockRestore()
    }
  })
})
