import type { PushSubscriptionData } from "@/lib/push/sender"
import { MAX_SUSCRIPCIONES, SubscriptionLimitError, type PushSubscriptionStore } from "@/lib/push/subscription-store"

/**
 * Mock-mode adapter: keyed by endpoint (natural key -- see the port's doc).
 * `maxSuscripciones` defaults to the production cap; tests inject a small
 * value to exercise the cap without creating hundreds of subscriptions.
 */
export class InMemoryPushSubscriptionStore implements PushSubscriptionStore {
  private readonly porEndpoint = new Map<string, PushSubscriptionData>()

  constructor(private readonly maxSuscripciones: number = MAX_SUSCRIPCIONES) {}

  async guardar(subscription: PushSubscriptionData): Promise<void> {
    const esNueva = !this.porEndpoint.has(subscription.endpoint)
    if (esNueva && this.porEndpoint.size >= this.maxSuscripciones) {
      throw new SubscriptionLimitError()
    }
    this.porEndpoint.set(subscription.endpoint, subscription)
  }

  async eliminar(endpoint: string): Promise<void> {
    this.porEndpoint.delete(endpoint)
  }

  async listar(): Promise<PushSubscriptionData[]> {
    return [...this.porEndpoint.values()]
  }
}
