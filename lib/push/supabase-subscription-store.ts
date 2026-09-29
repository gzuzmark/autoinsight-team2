import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import type { PushSubscriptionData } from "@/lib/push/sender"
import { MAX_SUSCRIPCIONES, SubscriptionLimitError, type PushSubscriptionStore } from "@/lib/push/subscription-store"

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

  /** `maxSuscripciones` defaults to the production cap; tests inject a
   * small value so the cap can be exercised without inserting hundreds of
   * real rows against the local stack. */
  constructor(
    url: string,
    secretKey: string,
    private readonly maxSuscripciones: number = MAX_SUSCRIPCIONES,
  ) {
    this.client = createClient<Database>(url, secretKey, { auth: { persistSession: false } })
  }

  async guardar(subscription: PushSubscriptionData): Promise<void> {
    const { data: existente, error: existenteError } = await this.client
      .from("push_subscripciones")
      .select("id")
      .eq("endpoint", subscription.endpoint)
      .maybeSingle()
    if (existenteError) throw new Error(existenteError.message)

    // Cap check only blocks a genuinely new endpoint -- re-subscribing an
    // existing one must keep working even once the cap is reached (upsert).
    if (!existente) {
      const { count, error: countError } = await this.client
        .from("push_subscripciones")
        .select("*", { count: "exact", head: true })
      if (countError) throw new Error(countError.message)
      if ((count ?? 0) >= this.maxSuscripciones) {
        throw new SubscriptionLimitError()
      }
    }

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
