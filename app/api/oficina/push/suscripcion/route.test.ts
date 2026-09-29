import { beforeEach, describe, expect, it, vi } from "vitest"
import { setPushSubscriptionStoreForTests } from "@/lib/push-subscription-store"
import { InMemoryPushSubscriptionStore } from "@/lib/push/in-memory-subscription-store"
import { POST, DELETE } from "./route"

const VALIDA = { endpoint: "https://push.example.com/abc", keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) } }

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/oficina/push/suscripcion", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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

  it("returns 400 for malformed JSON", async () => {
    const malformed = new Request("http://localhost/api/oficina/push/suscripcion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    })
    const res = await POST(malformed)
    expect(res.status).toBe(400)
  })

  it("returns 500 (no-store) instead of an unhandled throw when the store fails", async () => {
    vi.spyOn(store, "guardar").mockRejectedValue(new Error("db down"))
    const res = await POST(postReq(VALIDA))
    expect(res.status).toBe(500)
    expect(res.headers.get("cache-control")).toBe("no-store")
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
})
