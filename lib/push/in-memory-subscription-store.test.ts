import { beforeEach, describe, expect, it } from "vitest"
import { InMemoryPushSubscriptionStore } from "@/lib/push/in-memory-subscription-store"

const SUB_A = { endpoint: "https://push.example.com/a", keys: { p256dh: "pa", auth: "aa" } }
const SUB_B = { endpoint: "https://push.example.com/b", keys: { p256dh: "pb", auth: "ab" } }

describe("InMemoryPushSubscriptionStore", () => {
  let store: InMemoryPushSubscriptionStore

  beforeEach(() => {
    store = new InMemoryPushSubscriptionStore()
  })

  it("starts empty", async () => {
    expect(await store.listar()).toEqual([])
  })

  it("guardar then listar returns the saved subscription", async () => {
    await store.guardar(SUB_A)
    expect(await store.listar()).toEqual([SUB_A])
  })

  it("guardar upserts by endpoint (a re-subscribe overwrites, not duplicates)", async () => {
    await store.guardar(SUB_A)
    await store.guardar({ ...SUB_A, keys: { p256dh: "new", auth: "new" } })
    const rows = await store.listar()
    expect(rows.length).toBe(1)
    expect(rows[0].keys.p256dh).toBe("new")
  })

  it("eliminar removes by endpoint", async () => {
    await store.guardar(SUB_A)
    await store.guardar(SUB_B)
    await store.eliminar(SUB_A.endpoint)
    expect(await store.listar()).toEqual([SUB_B])
  })

  it("eliminar of an unknown endpoint is a no-op", async () => {
    await store.guardar(SUB_A)
    await store.eliminar("https://unknown")
    expect(await store.listar()).toEqual([SUB_A])
  })
})
