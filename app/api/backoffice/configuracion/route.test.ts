import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { currentToken } from "@/lib/backoffice/key-gate"
import { BACKOFFICE_COOKIE_NAME } from "@/lib/api/backoffice-cookie"
import { POST } from "./route"

function req(body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (cookie) headers.cookie = `${BACKOFFICE_COOKIE_NAME}=${cookie}`
  return new Request("http://localhost/api/backoffice/configuracion", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

describe("POST /api/backoffice/configuracion", () => {
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
    const res = await POST(req({ enviarReporteTurno: false }, "anything"))
    expect(res.status).toBe(503)
  })

  it("returns 401 with no valid cookie", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const res = await POST(req({ enviarReporteTurno: false }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for a non-boolean enviarReporteTurno", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    const res = await POST(req({ enviarReporteTurno: "sí" }, token))
    expect(res.status).toBe(400)
  })

  it("D5: returns a JSON 500 error body (no-store) instead of an unhandled throw when the repository fails", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    vi.spyOn(repo, "setEnviarReporteTurno").mockRejectedValue(new Error("boom"))

    const res = await POST(req({ enviarReporteTurno: false }, token))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(typeof body.error).toBe("string")
  })

  it("flips the toggle and returns 200", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!

    const res = await POST(req({ enviarReporteTurno: false }, token))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect((await repo.estadoDemo()).enviarReporteTurno).toBe(false)
  })
})
