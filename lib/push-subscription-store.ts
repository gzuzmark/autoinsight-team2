import "server-only"

import type { PushSubscriptionStore } from "@/lib/push/subscription-store"
import { InMemoryPushSubscriptionStore } from "@/lib/push/in-memory-subscription-store"
import { SupabasePushSubscriptionStore } from "@/lib/push/supabase-subscription-store"

/**
 * Composition root, same `DATA_SOURCE`-driven pattern and dev-mode
 * globalThis-singleton fix as lib/floor-repository.ts (G3).
 */
const GLOBAL_KEY = Symbol.for("autoinsight.pushSubscriptionStore")
type GlobalWithStore = typeof globalThis & { [GLOBAL_KEY]?: PushSubscriptionStore }

export function getPushSubscriptionStore(): PushSubscriptionStore {
  const g = globalThis as GlobalWithStore
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createPushSubscriptionStore()
  }
  return g[GLOBAL_KEY]
}

function createPushSubscriptionStore(): PushSubscriptionStore {
  const source = process.env.DATA_SOURCE ?? "mock"

  if (source === "supabase") {
    const url = process.env.SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!url || !secretKey) {
      throw new Error(
        "DATA_SOURCE=supabase requires SUPABASE_URL and SUPABASE_SECRET_KEY to be set (see .env.example).",
      )
    }
    return new SupabasePushSubscriptionStore(url, secretKey)
  }

  return new InMemoryPushSubscriptionStore()
}

/** Test seam, same rationale as setFloorRepositoryForTests. */
export function setPushSubscriptionStoreForTests(store: PushSubscriptionStore): void {
  ;(globalThis as GlobalWithStore)[GLOBAL_KEY] = store
}
