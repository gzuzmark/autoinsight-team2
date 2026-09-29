import type { PushSubscriptionData } from "@/lib/push/sender"
import type { PushSubscriptionStore } from "@/lib/push/subscription-store"

/** Mock-mode adapter: keyed by endpoint (natural key -- see the port's doc). */
export class InMemoryPushSubscriptionStore implements PushSubscriptionStore {
  private readonly porEndpoint = new Map<string, PushSubscriptionData>()

  async guardar(subscription: PushSubscriptionData): Promise<void> {
    this.porEndpoint.set(subscription.endpoint, subscription)
  }

  async eliminar(endpoint: string): Promise<void> {
    this.porEndpoint.delete(endpoint)
  }

  async listar(): Promise<PushSubscriptionData[]> {
    return [...this.porEndpoint.values()]
  }
}
