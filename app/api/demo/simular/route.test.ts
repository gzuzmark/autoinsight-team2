import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { SESSION_COOKIE_NAME } from "@/lib/api/session-cookie"
import { USUARIOS } from "@/lib/mock-data"
import { POST } from "./route"

function req(sessionId?: string): Request {
  const headers: Record<string, string> = {}
  if (sessionId) headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`
  return new Request("http://localhost/api/demo/simular", { method: "POST", headers })
}

describe("POST /api/demo/simular", () => {
  const originalDemoEnabled = process.env.DEMO_ENABLED

  afterEach(() => {
    if (originalDemoEnabled === undefined) delete process.env.DEMO_ENABLED
    else process.env.DEMO_ENABLED = originalDemoEnabled
  })

  it("returns 404 when DEMO_ENABLED is not set", async () => {
    delete process.env.DEMO_ENABLED
    setFloorRepositoryForTests(new InMemoryFloorRepository())

    const res = await POST(req("whatever"))

    expect(res.status).toBe(404)
  })

  it("returns 404 when DEMO_ENABLED is not exactly 'true'", async () => {
    process.env.DEMO_ENABLED = "1"
    setFloorRepositoryForTests(new InMemoryFloorRepository())

    const res = await POST(req("whatever"))

    expect(res.status).toBe(404)
  })

  describe("when DEMO_ENABLED=true", () => {
    beforeEach(() => {
      process.env.DEMO_ENABLED = "true"
    })

    it("returns 200 with the refreshed tablero for a valid session", async () => {
      const repo = new InMemoryFloorRepository()
      setFloorRepositoryForTests(repo)
      const sessionId = (await repo.iniciarSesion(USUARIOS[0].id, USUARIOS[0].pin))!
      const before = await repo.tablero(sessionId)

      const res = await POST(req(sessionId))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.alertas.length).toBeGreaterThan(before.alertas.length)
    })

    it("returns 401 with no session", async () => {
      setFloorRepositoryForTests(new InMemoryFloorRepository())
      const res = await POST(req())
      expect(res.status).toBe(401)
    })
  })
})
