import "server-only"

/**
 * G7b: VAPID config from env, same "read-once, documented default" pattern
 * as lib/backoffice/reporte-config.ts (G6). `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
 * is intentionally public (the browser needs it to call
 * `PushManager#subscribe`); the private key and subject stay server-only.
 */
export function vapidPublicKey(): string | undefined {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
}

export function vapidPrivateKey(): string | undefined {
  return process.env.VAPID_PRIVATE_KEY
}

export function vapidSubject(): string {
  return process.env.VAPID_SUBJECT ?? "mailto:demo-autoinsight@mailinator.com"
}

/** True only when every VAPID env var needed for real delivery is set. */
export function vapidConfigured(): boolean {
  return Boolean(vapidPublicKey() && vapidPrivateKey())
}
