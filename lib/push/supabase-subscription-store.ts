import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { PushSubscriptionData } from "@/lib/push/sender"
import type { PushSubscriptionStore } from "@/lib/push/subscription-store"

/**
 * Real-backend adapter for `public.push_subscripciones` (migration
 * 20260929000028), same style as SupabaseFloorRepository: a plain table
 * read/write with the service-role client (RLS-bypassing, server-only --
 * `import "server-only"` fails the build if this ever ends up in a client
 * bundle). No RPC needed -- a subscription row has no business rules, just
 * an upsert-by-endpoint and a delete-by-endpoint.
 */
export class SupabasePushSubscriptionStore implements PushSubscriptionStore {
  private readonly client: SupabaseClient<Database>

  constructor(url: string, secretKey: string) {
    this.client = createClient<Database>(url, secretKey, { auth: { persistSession: false } })
  }

  async guardar(subscription: PushSubscriptionData): Promise<void> {
    const { error } = await this.client
      .from("push_subscripciones")
      .upsert(
        { endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        { onConflict: "endpoint" },
      )
    if (error) throw new Error(error.message)
  }

  async eliminar(endpoint: string): Promise<void> {
    const { error } = await this.client.from("push_subscripciones").delete().eq("endpoint", endpoint)
    if (error) throw new Error(error.message)
  }

  async listar(): Promise<PushSubscriptionData[]> {
    const { data, error } = await this.client.from("push_subscripciones").select("endpoint,p256dh,auth")
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => ({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }))
  }
}
