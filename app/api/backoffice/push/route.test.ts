import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { currentToken } from "@/lib/backoffice/key-gate"
import { BACKOFFICE_COOKIE_NAME } from "@/lib/api/backoffice-cookie"
import { resetPushSenderForTests, setPushSenderForTests } from "@/lib/push/get-push-sender"
import { LogPushSender } from "@/lib/push/log-sender"
import { setPushSubscriptionStoreForTests } from "@/lib/push-subscription-store"
import { InMemoryPushSubscriptionStore } from "@/lib/push/in-memory-subscription-store"
import { POST } from "./route"

function req(cookie?: string): Request {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = `${BACKOFFICE_COOKIE_NAME}=${cookie}`
  return new Request("http://localhost/api/backoffice/push", { method: "POST", headers })
}

describe("POST /api/backoffice/push", () => {
  let repo: InMemoryFloorRepository

  beforeEach(() => {
    repo = new InMemoryFloorRepository()
    setFloorRepositoryForTests(repo)
    setPushSubscriptionStoreForTests(new InMemoryPushSubscriptionStore())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetPushSenderForTests()
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

  it("returns 404 with a clear message when there is no open ALTA alert", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    await repo.aplicarEscenario("todo-ok")

    const res = await POST(req(token))
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(typeof body.error).toBe("string")
  })

  it("notifies every stored subscription for the most recent ALTA alert", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    const sender = new LogPushSender()
    setPushSenderForTests(sender)
    const store = new InMemoryPushSubscriptionStore()
    await store.guardar({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "p", auth: "a" } })
    await store.guardar({ endpoint: "https://fcm.googleapis.com/fcm/send/2", keys: { p256dh: "p", auth: "a" } })
    setPushSubscriptionStoreForTests(store)

    const res = await POST(req(token))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, notificadas: 2 })
  })

  it("returns notificadas: 0 (still 200) when there are no stored subscriptions", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!

    const res = await POST(req(token))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, notificadas: 0 })
  })

  it("D5: returns a JSON 500 error body (no-store) instead of an unhandled throw when the repository fails", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    vi.spyOn(repo, "alertaAltaMasReciente").mockRejectedValue(new Error("boom"))

    const res = await POST(req(token))
    expect(res.status).toBe(500)
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
