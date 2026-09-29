import type { PushSubscriptionData } from "@/lib/push/sender"

/**
 * G7b/security hardening: `/oficina` has no auth (O-D4) -- anyone with the
 * URL can call `POST /api/oficina/push/suscripcion` (documented in the
 * README, accepted for this demo). Without a host allowlist, that
 * unauthenticated endpoint would let anyone register an arbitrary https URL
 * and have our server POST to it on every new ALTA alert (a server-side
 * request relay); `endpointServicioPermitido` closes that by only accepting
 * the actual Web Push service hosts real browsers use. Combined with shape
 * and generous but bounded size limits so one request cannot write an
 * oversized row.
 */
const MAX_ENDPOINT_LENGTH = 2048
const MAX_KEY_LENGTH = 512

/**
 * The exact set of Web Push service endpoints real browsers deliver to
 * (verified against `web-push`'s own README/examples in
 * node_modules/web-push, which use an `fcm.googleapis.com` endpoint --
 * `web-push` itself has no built-in host allowlist, it just forwards
 * whatever endpoint the browser gave the client):
 * - `fcm.googleapis.com` -- Chrome/Edge (Chromium), via Firebase Cloud
 *   Messaging.
 * - `updates.push.services.mozilla.com` -- Firefox (autopush).
 * - `web.push.apple.com` -- Safari/iOS (Apple Push Notification service
 *   for the web).
 * - `*.notify.windows.com` -- legacy (pre-Chromium) Edge/WNS. Kept as a
 *   suffix match since Microsoft has used multiple subdomains under this
 *   domain historically; matched on a dot boundary so it cannot be
 *   defeated by a lookalike like `evilnotify.windows.com`.
 */
const HOSTS_EXACTOS_PERMITIDOS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
])
const SUFIJO_WINDOWS = ".notify.windows.com"

function hostPermitido(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (HOSTS_EXACTOS_PERMITIDOS.has(host)) return true
  return host.length > SUFIJO_WINDOWS.length && host.endsWith(SUFIJO_WINDOWS)
}

/**
 * Defense-in-depth entry point, also used by lib/push/notify.ts to skip
 * (and clean up) any subscription whose endpoint no longer passes the
 * allowlist -- e.g. one stored before this hardening landed, or one that
 * slipped past validation some other way.
 */
export function endpointServicioPermitido(endpoint: string): boolean {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== "https:") return false
  if (url.username !== "" || url.password !== "") return false
  if (url.port !== "") return false
  return hostPermitido(url.hostname)
}

export type ValidacionSuscripcion = { ok: true; data: PushSubscriptionData } | { ok: false; error: string }

export function validarSuscripcion(input: unknown): ValidacionSuscripcion {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Cuerpo inválido." }
  }
  const { endpoint, keys } = input as Record<string, unknown>

  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > MAX_ENDPOINT_LENGTH) {
    return { ok: false, error: "endpoint inválido." }
  }
  try {
    new URL(endpoint)
  } catch {
    return { ok: false, error: "endpoint no es una URL válida." }
  }
  if (!endpointServicioPermitido(endpoint)) {
    return { ok: false, error: "endpoint no corresponde a un servicio de notificaciones admitido." }
  }

  if (typeof keys !== "object" || keys === null) {
    return { ok: false, error: "keys inválido." }
  }
  const { p256dh, auth } = keys as Record<string, unknown>
  if (typeof p256dh !== "string" || p256dh.length === 0 || p256dh.length > MAX_KEY_LENGTH) {
    return { ok: false, error: "keys.p256dh inválido." }
  }
  if (typeof auth !== "string" || auth.length === 0 || auth.length > MAX_KEY_LENGTH) {
    return { ok: false, error: "keys.auth inválido." }
  }

  return { ok: true, data: { endpoint, keys: { p256dh, auth } } }
}
