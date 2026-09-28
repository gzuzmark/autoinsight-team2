import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { currentToken } from "@/lib/backoffice/key-gate"
import { BACKOFFICE_COOKIE_NAME } from "@/lib/api/backoffice-cookie"
import { POST } from "./route"

function req(body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (cookie) headers.cookie = `${BACKOFFICE_COOKIE_NAME}=${cookie}`
  return new Request("http://localhost/api/backoffice/escenario", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

describe("POST /api/backoffice/escenario", () => {
  let repo: InMemoryFloorRepository

  beforeEach(() => {
    repo = new InMemoryFloorRepository()
    setFloorRepositoryForTests(repo)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("fails closed with 503 when BACKOFFICE_KEY is unset", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "")
    const res = await POST(req({ escenario: "todo-ok" }, "anything"))
    expect(res.status).toBe(503)
  })

  it("returns 401 with no valid cookie", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const res = await POST(req({ escenario: "todo-ok" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for a missing/unknown escenario", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    const res = await POST(req({ escenario: "no-existe" }, token))
    expect(res.status).toBe(400)
  })

  it("returns 400 for malformed JSON", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    const malformed = new Request("http://localhost/api/backoffice/escenario", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${BACKOFFICE_COOKIE_NAME}=${token}` },
      body: "{not json",
    })
    const res = await POST(malformed)
    expect(res.status).toBe(400)
  })

  it("applies the given scenario and returns 200 with a valid cookie/escenario", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    const spy = vi.spyOn(repo, "aplicarEscenario")

    const res = await POST(req({ escenario: "linea3-parar-alta" }, token))

    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith("linea3-parar-alta")
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
