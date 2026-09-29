import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { currentToken } from "@/lib/backoffice/key-gate"
import { BACKOFFICE_COOKIE_NAME } from "@/lib/api/backoffice-cookie"
import { POST } from "./route"

function req(cookie?: string): Request {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = `${BACKOFFICE_COOKIE_NAME}=${cookie}`
  return new Request("http://localhost/api/backoffice/reiniciar", { method: "POST", headers })
}

describe("POST /api/backoffice/reiniciar", () => {
  let repo: InMemoryFloorRepository

  beforeEach(() => {
    repo = new InMemoryFloorRepository()
    setFloorRepositoryForTests(repo)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("fails closed with 503 when BACKOFFICE_KEY is unset, regardless of cookie", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "")
    const res = await POST(req("anything"))
    expect(res.status).toBe(503)
  })

  it("returns 401 with no cookie", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it("returns 401 with an invalid/stale cookie token", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const res = await POST(req("not-the-real-token"))
    expect(res.status).toBe(401)
  })

  it("D5: returns a JSON 500 error body (no-store) instead of an unhandled throw when the repository fails", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    vi.spyOn(repo, "reiniciarDemo").mockRejectedValue(new Error("boom"))

    const res = await POST(req(token))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(typeof body.error).toBe("string")
  })

  it("resets the demo and returns 200 with a valid cookie", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    const spy = vi.spyOn(repo, "reiniciarDemo")

    const res = await POST(req(token))

    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
