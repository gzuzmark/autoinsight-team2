import { beforeEach, describe, expect, it, vi } from "vitest"
import { setPushSubscriptionStoreForTests } from "@/lib/push-subscription-store"
import { InMemoryPushSubscriptionStore } from "@/lib/push/in-memory-subscription-store"
import { POST, DELETE } from "./route"

const VALIDA = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) } }
const VALIDA_2 = {
  endpoint: "https://updates.push.services.mozilla.com/wpush/v2/xyz",
  keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) },
}

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/oficina/push/suscripcion", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function postReqRaw(body: string, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/oficina/push/suscripcion", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  })
}

function deleteReq(body: unknown): Request {
  return new Request("http://localhost/api/oficina/push/suscripcion", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/oficina/push/suscripcion", () => {
  let store: InMemoryPushSubscriptionStore

  beforeEach(() => {
    store = new InMemoryPushSubscriptionStore()
    setPushSubscriptionStoreForTests(store)
  })

  it("no auth required -- stores a valid subscription and returns 200", async () => {
    const res = await POST(postReq(VALIDA))
    expect(res.status).toBe(200)
    expect(await store.listar()).toEqual([VALIDA])
  })

  it("returns 400 for an invalid subscription (validarSuscripcion rejects it)", async () => {
    const res = await POST(postReq({ endpoint: "http://not-https", keys: VALIDA.keys }))
    expect(res.status).toBe(400)
    expect(await store.listar()).toEqual([])
  })

  it("returns 400 for an endpoint host not on the push-service allowlist", async () => {
    const res = await POST(postReq({ endpoint: "https://evil.com/x", keys: VALIDA.keys }))
    expect(res.status).toBe(400)
    expect(await store.listar()).toEqual([])
  })

  it("returns 400 for malformed JSON", async () => {
    const res = await POST(postReqRaw("{not json"))
    expect(res.status).toBe(400)
  })

  it("returns 413 for an oversized request body", async () => {
    const gigante = { endpoint: VALIDA.endpoint, keys: { p256dh: "p".repeat(20000), auth: "a" } }
    const res = await POST(postReq(gigante))
    expect(res.status).toBe(413)
    expect(await store.listar()).toEqual([])
  })

  it("returns 413 when Content-Length alone already exceeds the body cap", async () => {
    const res = await postReqRaw(JSON.stringify(VALIDA), { "content-length": String(50 * 1024) })
    const response = await POST(res)
    expect(response.status).toBe(413)
  })

  it("returns 500 (no-store) instead of an unhandled throw when the store fails", async () => {
    vi.spyOn(store, "guardar").mockRejectedValue(new Error("db down"))
    const res = await POST(postReq(VALIDA))
    expect(res.status).toBe(500)
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("returns 429 when the subscription cap is reached for a genuinely new endpoint", async () => {
    store = new InMemoryPushSubscriptionStore(1)
    setPushSubscriptionStoreForTests(store)
    const first = await POST(postReq(VALIDA))
    expect(first.status).toBe(200)
    const second = await POST(postReq(VALIDA_2))
    expect(second.status).toBe(429)
    expect(await store.listar()).toEqual([VALIDA])
  })

  it("still allows re-subscribing an existing endpoint once the cap is reached", async () => {
    store = new InMemoryPushSubscriptionStore(1)
    setPushSubscriptionStoreForTests(store)
    await POST(postReq(VALIDA))
    const resubscribe = await POST(postReq({ ...VALIDA, keys: { p256dh: "q".repeat(87), auth: "b".repeat(22) } }))
    expect(resubscribe.status).toBe(200)
    expect((await store.listar())[0].keys.p256dh).toBe("q".repeat(87))
  })
})

describe("DELETE /api/oficina/push/suscripcion", () => {
  let store: InMemoryPushSubscriptionStore

  beforeEach(() => {
    store = new InMemoryPushSubscriptionStore()
    setPushSubscriptionStoreForTests(store)
  })

  it("removes a subscription by endpoint", async () => {
    await store.guardar(VALIDA)
    const res = await DELETE(deleteReq({ endpoint: VALIDA.endpoint }))
    expect(res.status).toBe(200)
    expect(await store.listar()).toEqual([])
  })

  it("is idempotent for an unknown endpoint", async () => {
    const res = await DELETE(deleteReq({ endpoint: "https://unknown" }))
    expect(res.status).toBe(200)
  })

  it("returns 400 for a missing endpoint", async () => {
    const res = await DELETE(deleteReq({}))
    expect(res.status).toBe(400)
  })

  it("returns 413 for an oversized request body", async () => {
    const res = await DELETE(postReqRaw(JSON.stringify({ endpoint: "https://a".repeat(5000) })))
    expect(res.status).toBe(413)
  })
})
