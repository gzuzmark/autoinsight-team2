import { beforeEach, describe, expect, it } from "vitest"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { SESSION_COOKIE_NAME } from "@/lib/api/session-cookie"
import { USUARIOS } from "@/lib/mock-data"
import { GET } from "./route"

async function login(): Promise<string> {
  const repo = new InMemoryFloorRepository()
  setFloorRepositoryForTests(repo)
  const sessionId = await repo.iniciarSesion(USUARIOS[0].id, USUARIOS[0].pin)
  return sessionId!
}

function reqWithSession(sessionId?: string): Request {
  const headers: Record<string, string> = {}
  if (sessionId) headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`
  return new Request("http://localhost/api/tablero", { headers })
}

describe("GET /api/tablero", () => {
  it("returns 200 with the tablero payload for a valid session", async () => {
    const sessionId = await login()

    const res = await GET(reqWithSession(sessionId))

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    const body = await res.json()
    expect(body.usuario.id).toBe(USUARIOS[0].id)
    expect(body.alertas.length).toBeGreaterThan(0)
  })

  it("returns 401 with no session cookie", async () => {
    setFloorRepositoryForTests(new InMemoryFloorRepository())
    const res = await GET(reqWithSession())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Sesión inválida o expirada." })
  })

  it("returns 401 for an unknown/expired session", async () => {
    setFloorRepositoryForTests(new InMemoryFloorRepository())
    const res = await GET(reqWithSession("does-not-exist"))
    expect(res.status).toBe(401)
  })
})
