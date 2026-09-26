import { beforeEach, describe, expect, it } from "vitest"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { USUARIOS } from "@/lib/mock-data"
import { GET } from "./route"

describe("GET /api/usuarios", () => {
  beforeEach(() => {
    setFloorRepositoryForTests(new InMemoryFloorRepository())
  })

  it("returns 200 with the active users, no PIN, and no-store caching", async () => {
    const res = await GET()

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    const body = await res.json()
    expect(body.length).toBe(USUARIOS.length)
    for (const u of body) {
      expect(u).not.toHaveProperty("pin")
    }
  })
})
