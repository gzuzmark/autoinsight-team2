import "server-only"

import webpush from "web-push"
import { PushSubscriptionGoneError, type PushPayload, type PushSender, type PushSubscriptionData } from "@/lib/push/sender"

/**
 * G7b: `web-push` adapter (VAPID keys -- see the README's "Web push
 * notifications" section for how to generate them). Server-only: this must
 * never end up in a client bundle.
 *
 * Maps a push-service 404/410 (the subscription is gone -- the user
 * uninstalled, cleared site data, or the endpoint expired) to
 * `PushSubscriptionGoneError` so the caller (lib/push/notify.ts) can clean
 * it up instead of retrying it forever. Any other failure rejects with the
 * underlying error, same "can reject" contract as GmailSmtpSender (G6).
 */
export class WebPushSender implements PushSender {
  constructor(publicKey: string, privateKey: string, subject: string) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
  }

  async send(subscription: PushSubscriptionData, payload: PushPayload): Promise<void> {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        JSON.stringify(payload),
      )
    } catch (err) {
      if (err instanceof webpush.WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
        throw new PushSubscriptionGoneError(`Subscription gone (HTTP ${err.statusCode}).`)
      }
      throw err
    }
  }
}
