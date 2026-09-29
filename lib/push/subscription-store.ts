import type { PushSubscriptionData } from "@/lib/push/sender"

/**
 * G7b: storage port for office push subscriptions, mirroring
 * FloorRepository's port/adapter shape (mock/Supabase). Endpoint is the
 * natural key -- a re-subscribe from the same browser overwrites the
 * previous row (upsert) instead of accumulating duplicates.
 */
export interface PushSubscriptionStore {
  guardar(subscription: PushSubscriptionData): Promise<void>
  eliminar(endpoint: string): Promise<void>
  listar(): Promise<PushSubscriptionData[]>
}
