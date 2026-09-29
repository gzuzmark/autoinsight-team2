import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { currentToken } from "@/lib/backoffice/key-gate"
import { BACKOFFICE_COOKIE_NAME } from "@/lib/api/backoffice-cookie"
import { resetEmailSenderForTests, setEmailSenderForTests } from "@/lib/email/get-email-sender"
import { LogEmailSender } from "@/lib/email/log-sender"
import type { EmailSender } from "@/lib/email/sender"
import { POST } from "./route"

function req(cookie?: string): Request {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = `${BACKOFFICE_COOKIE_NAME}=${cookie}`
  return new Request("http://localhost/api/backoffice/correo", { method: "POST", headers })
}

describe("POST /api/backoffice/correo", () => {
  let repo: InMemoryFloorRepository

  beforeEach(() => {
    repo = new InMemoryFloorRepository()
    setFloorRepositoryForTests(repo)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetEmailSenderForTests()
  })

  it("fails closed with 503 when BACKOFFICE_KEY is unset", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "")
    const res = await POST(req("anything"))
    expect(res.status).toBe(503)
  })

  it("returns 401 with no valid cookie", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it("sends a current-state report to every configured recipient and returns 200", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    const sender = new LogEmailSender()
    setEmailSenderForTests(sender)

    const res = await POST(req(token))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(sender.enviados).toHaveLength(1)
    expect(sender.enviados[0].subject).toContain("Reporte de estado")
  })

  it("D5: returns a JSON 500 error body (no-store) instead of an unhandled throw when estadoDemo() fails", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    vi.spyOn(repo, "estadoDemo").mockRejectedValue(new Error("boom"))

    const res = await POST(req(token))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(typeof body.error).toBe("string")
  })

  it("returns an inline error (never 200) when sending fails", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    const fallando: EmailSender = { send: vi.fn().mockRejectedValue(new Error("SMTP down")) }
    setEmailSenderForTests(fallando)

    const res = await POST(req(token))
    const body = await res.json()

    expect(res.status).not.toBe(200)
    expect(body.ok).toBeFalsy()
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
