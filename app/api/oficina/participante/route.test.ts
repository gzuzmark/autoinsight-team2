import { beforeEach, describe, expect, it, vi } from "vitest"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { GET } from "./route"

/**
 * G8: the office has no session/auth (O-D4, same as every other
 * /api/oficina/** route) -- this only exposes the current participant
 * NUMBER (facilitator-visible bookkeeping, not sensitive) so the office
 * screens can identify their PostHog events the same way the floor does.
 */
describe("GET /api/oficina/participante", () => {
  let repo: InMemoryFloorRepository

  beforeEach(() => {
    repo = new InMemoryFloorRepository()
    setFloorRepositoryForTests(repo)
  })

  it("returns the current participant number, no-store", async () => {
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ participante: 1 })
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("reflects a bumped participant", async () => {
    await repo.nuevoParticipante()
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual({ participante: 2 })
  })

  it("degrades to 1 instead of failing when the repository throws", async () => {
    vi.spyOn(repo, "estadoDemo").mockRejectedValue(new Error("boom"))
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ participante: 1 })
  })
})
