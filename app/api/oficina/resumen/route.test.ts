import { describe, expect, it } from "vitest"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import type { FloorRepository, ResumenOficina } from "@/lib/domain/floor-repository"
import { GET } from "@/app/api/oficina/resumen/route"

describe("GET /api/oficina/resumen (G10)", () => {
  it("returns 200 with the real resumen from the repository", async () => {
    setFloorRepositoryForTests(new InMemoryFloorRepository())
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { resumen?: ResumenOficina }
    expect(body.resumen).toBeDefined()
    expect(body.resumen!.indicadores.map((i) => i.clave)).toEqual(["fpy", "dph", "scrap"])
  })

  it("degrades to a JSON error when the repository fails, instead of throwing", async () => {
    // Preserves every other InMemoryFloorRepository method via the
    // prototype (a plain object spread would drop them -- they live on the
    // prototype, not as own instance properties) and overrides only the one
    // method this route actually calls.
    const boom = Object.assign(
      Object.create(InMemoryFloorRepository.prototype),
      new InMemoryFloorRepository(),
      { resumenOficina: async () => { throw new Error("boom") } },
    ) as FloorRepository
    setFloorRepositoryForTests(boom)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { resumen: unknown; error?: string }
    expect(body.resumen).toBeNull()
    expect(typeof body.error).toBe("string")
  })
})
