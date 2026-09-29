/**
 * G7b: push port, same shape/rationale as lib/email/sender.ts (G6) -- both
 * adapters (`LogPushSender`, `WebPushSender`) implement this so callers
 * never depend on `web-push` directly.
 */
export type PushSubscriptionKeys = {
  p256dh: string
  auth: string
}

export type PushSubscriptionData = {
  endpoint: string
  keys: PushSubscriptionKeys
}

export type PushPayload = {
  title: string
  body: string
  /** Groups notifications for the same alert (service worker `tag`) so a
   * re-triggered push replaces the previous one instead of stacking. */
  tag: string
  /** Office URL the notification click should focus/open. */
  url: string
}

/** Thrown by an adapter when the push service reports the subscription is
 * gone (HTTP 404/410) -- the caller (lib/push/notify.ts) uses this to know
 * which subscriptions to delete instead of retrying them forever. */
export class PushSubscriptionGoneError extends Error {
  constructor(message = "Push subscription is no longer valid.") {
    super(message)
    this.name = "PushSubscriptionGoneError"
  }
}

export interface PushSender {
  /**
   * `WebPushSender` can reject (a real delivery failure, including
   * `PushSubscriptionGoneError` for a 404/410); `LogPushSender` never
   * rejects (see its own doc). Callers that must not fail their own
   * operation on a delivery failure catch this themselves.
   */
  send(subscription: PushSubscriptionData, payload: PushPayload): Promise<void>
}
