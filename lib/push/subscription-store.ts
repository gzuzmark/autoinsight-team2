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

/**
 * Security hardening: `/oficina` has no auth (O-D4), so the subscription
 * table is otherwise unbounded -- cap it. An endpoint that is already
 * stored can still upsert (re-subscribing must keep working) even once the
 * cap is reached; only a genuinely new endpoint is rejected.
 */
export const MAX_SUSCRIPCIONES = 200

export class SubscriptionLimitError extends Error {
  constructor(message = "Se alcanzó el límite de suscripciones.") {
    super(message)
    this.name = "SubscriptionLimitError"
  }
}
