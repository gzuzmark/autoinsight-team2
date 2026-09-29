import type { PushPayload, PushSender, PushSubscriptionData } from "@/lib/push/sender"

/**
 * G7b fallback adapter: used whenever VAPID keys are missing, and always in
 * tests. Never throws -- a push notification is a nice-to-have during a
 * demo, never something that should break a caller with no VAPID keys
 * configured (e.g. local dev with mock data), same rationale as
 * lib/email/log-sender.ts (G6).
 */
export class LogPushSender implements PushSender {
  readonly enviados: { subscription: PushSubscriptionData; payload: PushPayload }[] = []

  async send(subscription: PushSubscriptionData, payload: PushPayload): Promise<void> {
    this.enviados.push({ subscription, payload })
    try {
      console.log(`push skipped: not configured (title: "${payload.title}", endpoint: ${subscription.endpoint})`)
    } catch {
      // Logging itself failing must not turn a no-op fallback into a throw.
    }
  }
}
