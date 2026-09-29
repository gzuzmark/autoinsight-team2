import { createClient } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { SupabasePushSubscriptionStore } from "@/lib/push/supabase-subscription-store"
import { SubscriptionLimitError } from "@/lib/push/subscription-store"

/** Integration test against a REAL local Supabase stack, same skip rule as
 * lib/domain/supabase-floor-repository.integration.test.ts. */
const url = process.env.SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const canRun = Boolean(url && secretKey)

const SUB = { endpoint: "https://push.example.com/integration-test", keys: { p256dh: "p", auth: "a" } }

describe.skipIf(!canRun)("SupabasePushSubscriptionStore (integration, local stack)", () => {
  const store = canRun ? new SupabasePushSubscriptionStore(url!, secretKey!) : (null as never)

  it("guardar upserts by endpoint, listar/eliminar round-trip over real PostgREST", async () => {
    await store.eliminar(SUB.endpoint) // clean slate regardless of prior runs

    await store.guardar(SUB)
    let rows = await store.listar()
    expect(rows.find((r) => r.endpoint === SUB.endpoint)).toEqual(SUB)

    await store.guardar({ ...SUB, keys: { p256dh: "new", auth: "new" } })
    rows = await store.listar()
    expect(rows.filter((r) => r.endpoint === SUB.endpoint).length).toBe(1)
    expect(rows.find((r) => r.endpoint === SUB.endpoint)?.keys.p256dh).toBe("new")

    await store.eliminar(SUB.endpoint)
    rows = await store.listar()
    expect(rows.find((r) => r.endpoint === SUB.endpoint)).toBeUndefined()
  })
})

const SUB_CAP_A = { endpoint: "https://push.example.com/cap-a", keys: { p256dh: "p", auth: "a" } }
const SUB_CAP_B = { endpoint: "https://push.example.com/cap-b", keys: { p256dh: "p", auth: "a" } }

describe.skipIf(!canRun)("SupabasePushSubscriptionStore cap (integration, local stack)", () => {
  it("rejects a genuinely new endpoint once the cap is reached, but still allows re-subscribing an existing one", async () => {
    // maxSuscripciones=0 relative to whatever else is in the table isn't
    // reliable across test runs, so use the real store to clear the two
    // rows this test owns, then drive a store capped at "however many other
    // rows already exist" so this test's first insert lands right at the
    // cap regardless of what else is in the table.
    const real = new SupabasePushSubscriptionStore(url!, secretKey!)
    await real.eliminar(SUB_CAP_A.endpoint)
    await real.eliminar(SUB_CAP_B.endpoint)
    const probe = createClient(url!, secretKey!, { auth: { persistSession: false } })
    const { count } = await probe.from("push_subscripciones").select("*", { count: "exact", head: true })
    const capped = new SupabasePushSubscriptionStore(url!, secretKey!, (count ?? 0) + 1)

    await capped.guardar(SUB_CAP_A)
    await expect(capped.guardar(SUB_CAP_B)).rejects.toThrow(SubscriptionLimitError)

    const reSuscripcion = { ...SUB_CAP_A, keys: { p256dh: "new", auth: "new" } }
    await expect(capped.guardar(reSuscripcion)).resolves.toBeUndefined()
    const rows = await capped.listar()
    expect(rows.find((r) => r.endpoint === SUB_CAP_A.endpoint)?.keys.p256dh).toBe("new")
    expect(rows.find((r) => r.endpoint === SUB_CAP_B.endpoint)).toBeUndefined()

    await real.eliminar(SUB_CAP_A.endpoint)
    await real.eliminar(SUB_CAP_B.endpoint)
  })
})

if (!canRun) {
  // eslint-disable-next-line no-console
  console.log(
    "SupabasePushSubscriptionStore integration test SKIPPED: set SUPABASE_URL and SUPABASE_SECRET_KEY to run it.",
  )
}
