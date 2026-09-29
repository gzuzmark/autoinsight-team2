import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { currentToken } from "@/lib/backoffice/key-gate"
import { BACKOFFICE_COOKIE_NAME } from "@/lib/api/backoffice-cookie"
import { resetPushSenderForTests, setPushSenderForTests } from "@/lib/push/get-push-sender"
import { LogPushSender } from "@/lib/push/log-sender"
import type { PushSender } from "@/lib/push/sender"
import { setPushSubscriptionStoreForTests } from "@/lib/push-subscription-store"
import { InMemoryPushSubscriptionStore } from "@/lib/push/in-memory-subscription-store"
import { POST } from "./route"

function req(cookie?: string): Request {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = `${BACKOFFICE_COOKIE_NAME}=${cookie}`
  return new Request("http://localhost/api/backoffice/push", { method: "POST", headers })
}

const FAILING_SENDER: PushSender = {
  send: vi.fn(async () => {
    throw new Error("push service unreachable")
  }),
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

  it("I-1: returns 200 with a clear neutral message (not an error) when there are no stored subscriptions", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!

    const res = await POST(req(token))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.notificadas).toBe(0)
    expect(typeof body.mensaje).toBe("string")
    expect(body.mensaje.length).toBeGreaterThan(0)
  })

  it("I-1: returns 502 (a real error) when at least one send was attempted and every one of them failed", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    setPushSenderForTests(FAILING_SENDER)
    const store = new InMemoryPushSubscriptionStore()
    await store.guardar({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "p", auth: "a" } })
    setPushSubscriptionStoreForTests(store)

    const res = await POST(req(token))
    const body = await res.json()
    expect(res.status).toBe(502)
    expect(typeof body.error).toBe("string")
  })

  it("I-1: returns 502 when the subscription list itself could not be read", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    setPushSubscriptionStoreForTests({
      listar: vi.fn(async () => {
        throw new Error("db down")
      }),
      guardar: vi.fn(),
      eliminar: vi.fn(),
    })

    const res = await POST(req(token))
    const body = await res.json()
    expect(res.status).toBe(502)
    expect(typeof body.error).toBe("string")
  })

  it("I-1: returns 200 with the delivered count on a partial failure (a mix of success and failure)", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    let calls = 0
    setPushSenderForTests({
      send: vi.fn(async () => {
        calls++
        if (calls === 1) throw new Error("one failed")
      }),
    })
    const store = new InMemoryPushSubscriptionStore()
    await store.guardar({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "p", auth: "a" } })
    await store.guardar({ endpoint: "https://fcm.googleapis.com/fcm/send/2", keys: { p256dh: "p", auth: "a" } })
    setPushSubscriptionStoreForTests(store)

    const res = await POST(req(token))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, notificadas: 1 })
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
