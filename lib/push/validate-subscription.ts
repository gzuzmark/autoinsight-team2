import type { PushSubscriptionData } from "@/lib/push/sender"

/**
 * G7b: `/oficina` has no auth (O-D4) -- anyone with the URL can call
 * `POST /api/oficina/push/suscripcion` (documented in the README, accepted
 * for this demo). This is the only gate on that unauthenticated input:
 * shape, an https endpoint (the only scheme any real push service uses --
 * also rules out `javascript:`/`data:` etc.), and generous but bounded
 * size limits so one request cannot write an oversized row.
 */
const MAX_ENDPOINT_LENGTH = 2048
const MAX_KEY_LENGTH = 512

export type ValidacionSuscripcion = { ok: true; data: PushSubscriptionData } | { ok: false; error: string }

export function validarSuscripcion(input: unknown): ValidacionSuscripcion {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Cuerpo inválido." }
  }
  const { endpoint, keys } = input as Record<string, unknown>

  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > MAX_ENDPOINT_LENGTH) {
    return { ok: false, error: "endpoint inválido." }
  }
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return { ok: false, error: "endpoint no es una URL válida." }
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "endpoint debe ser https." }
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
