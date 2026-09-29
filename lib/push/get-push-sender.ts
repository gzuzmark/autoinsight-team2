import "server-only"

import { WebPushSender } from "@/lib/push/webpush-sender"
import { LogPushSender } from "@/lib/push/log-sender"
import { vapidConfigured, vapidPrivateKey, vapidPublicKey, vapidSubject } from "@/lib/push/config"
import type { PushSender } from "@/lib/push/sender"

/**
 * G7b composition root for the push port, same globalThis-singleton
 * pattern as lib/email/get-email-sender.ts (G6) -- avoids dev-mode's
 * separate-bundle-per-layer problem re-creating the sender (and losing
 * `LogPushSender#enviados`) on every request.
 */
const GLOBAL_KEY = Symbol.for("autoinsight.pushSender")
type GlobalWithSender = typeof globalThis & { [GLOBAL_KEY]?: PushSender }

export function getPushSender(): PushSender {
  const g = globalThis as GlobalWithSender
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createPushSender()
  }
  return g[GLOBAL_KEY]
}

function createPushSender(): PushSender {
  if (vapidConfigured()) {
    return new WebPushSender(vapidPublicKey()!, vapidPrivateKey()!, vapidSubject())
  }
  // Missing VAPID keys: never throws, just skips real delivery -- a
  // facilitator running mock mode locally must not need VAPID keys for the
  // rest of the back office to work.
  return new LogPushSender()
}

export function resetPushSenderForTests(): void {
  delete (globalThis as GlobalWithSender)[GLOBAL_KEY]
}

export function setPushSenderForTests(sender: PushSender): void {
  ;(globalThis as GlobalWithSender)[GLOBAL_KEY] = sender
}
