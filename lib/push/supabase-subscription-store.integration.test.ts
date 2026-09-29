import { describe, expect, it } from "vitest"
import { SupabasePushSubscriptionStore } from "@/lib/push/supabase-subscription-store"

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

if (!canRun) {
  // eslint-disable-next-line no-console
  console.log(
    "SupabasePushSubscriptionStore integration test SKIPPED: set SUPABASE_URL and SUPABASE_SECRET_KEY to run it.",
  )
}
