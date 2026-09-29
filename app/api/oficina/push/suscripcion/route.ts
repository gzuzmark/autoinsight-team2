import "server-only"

import { validarSuscripcion } from "@/lib/push/validate-subscription"
import { SubscriptionLimitError } from "@/lib/push/subscription-store"
import { getPushSubscriptionStore } from "@/lib/push-subscription-store"

const NO_STORE = { "Cache-Control": "no-store" }
const ERROR_INTERNO = { error: "No se pudo guardar la suscripción. Intenta de nuevo." }
const ERROR_CUERPO_INVALIDO = { error: "Cuerpo inválido." }
const ERROR_CUERPO_GRANDE = { error: "Cuerpo demasiado grande." }
const ERROR_LIMITE = { error: "Se alcanzó el límite de suscripciones. Intenta más tarde." }

// Generous but bounded: well over MAX_ENDPOINT_LENGTH + 2 * MAX_KEY_LENGTH
// plus JSON overhead (see validate-subscription.ts), but small enough that
// a request body can never be used to write/hold an oversized payload.
const MAX_BODY_BYTES = 8 * 1024

/** Reads the request body as text, rejecting (413) anything over
 * MAX_BODY_BYTES before it is ever parsed as JSON -- the Content-Length
 * header is checked first as a cheap early-out, but the real limit is
 * enforced on the actual read since that header can be absent or wrong. */
async function leerCuerpoLimitado(request: Request): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
  const contentLength = request.headers.get("content-length")
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return { ok: false, status: 413 }
  }
  let text: string
  try {
    text = await request.text()
  } catch {
    return { ok: false, status: 400 }
  }
  if (text.length > MAX_BODY_BYTES) {
    return { ok: false, status: 413 }
  }
  return { ok: true, text }
}

function parsearJson(text: string): { ok: true; json: unknown } | { ok: false } {
  try {
    return { ok: true, json: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

/**
 * POST /api/oficina/push/suscripcion (G7b): stores an office browser's Web
 * Push subscription (endpoint upsert -- see PushSubscriptionStore's doc).
 *
 * `/oficina` has no auth (O-D4/O-D3): unlike every `/api/backoffice/*`
 * route, this one is NOT cookie-gated -- anyone with the `/oficina` URL can
 * subscribe. Documented and accepted for this demo (README); the gates on
 * this unauthenticated input are `validarSuscripcion` (https endpoint on
 * the real push-service allowlist, bounded sizes), a bounded request body,
 * and a cap on the total number of stored subscriptions.
 */
export async function POST(request: Request): Promise<Response> {
  const cuerpo = await leerCuerpoLimitado(request)
  if (!cuerpo.ok) {
    const body = cuerpo.status === 413 ? ERROR_CUERPO_GRANDE : ERROR_CUERPO_INVALIDO
    return Response.json(body, { status: cuerpo.status, headers: NO_STORE })
  }
  const parsed = parsearJson(cuerpo.text)
  if (!parsed.ok) {
    return Response.json(ERROR_CUERPO_INVALIDO, { status: 400, headers: NO_STORE })
  }

  const validado = validarSuscripcion(parsed.json)
  if (!validado.ok) {
    return Response.json({ error: validado.error }, { status: 400, headers: NO_STORE })
  }

  try {
    await getPushSubscriptionStore().guardar(validado.data)
  } catch (err) {
    if (err instanceof SubscriptionLimitError) {
      return Response.json(ERROR_LIMITE, { status: 429, headers: NO_STORE })
    }
    console.error("[oficina] guardar suscripción failed:", err)
    return Response.json(ERROR_INTERNO, { status: 500, headers: NO_STORE })
  }

  return Response.json({ ok: true }, { headers: NO_STORE })
}

/** DELETE /api/oficina/push/suscripcion (G7b): "Desactivar" -- removes the
 * subscription by endpoint. Idempotent: deleting an unknown endpoint is a
 * no-op 200, same rationale as FloorRepository#cerrarSesion. */
export async function DELETE(request: Request): Promise<Response> {
  const cuerpo = await leerCuerpoLimitado(request)
  if (!cuerpo.ok) {
    const body = cuerpo.status === 413 ? ERROR_CUERPO_GRANDE : ERROR_CUERPO_INVALIDO
    return Response.json(body, { status: cuerpo.status, headers: NO_STORE })
  }
  const parsed = parsearJson(cuerpo.text)
  if (!parsed.ok || typeof parsed.json !== "object" || parsed.json === null) {
    return Response.json(ERROR_CUERPO_INVALIDO, { status: 400, headers: NO_STORE })
  }
  const endpoint = (parsed.json as Record<string, unknown>).endpoint
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return Response.json({ error: "endpoint inválido." }, { status: 400, headers: NO_STORE })
  }

  try {
    await getPushSubscriptionStore().eliminar(endpoint)
  } catch (err) {
    console.error("[oficina] eliminar suscripción failed:", err)
    return Response.json(ERROR_INTERNO, { status: 500, headers: NO_STORE })
  }

  return Response.json({ ok: true }, { headers: NO_STORE })
}
