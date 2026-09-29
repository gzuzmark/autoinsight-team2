import "server-only"

import { validarSuscripcion } from "@/lib/push/validate-subscription"
import { getPushSubscriptionStore } from "@/lib/push-subscription-store"

const NO_STORE = { "Cache-Control": "no-store" }
const ERROR_INTERNO = { error: "No se pudo guardar la suscripción. Intenta de nuevo." }

/**
 * POST /api/oficina/push/suscripcion (G7b): stores an office browser's Web
 * Push subscription (endpoint upsert -- see PushSubscriptionStore's doc).
 *
 * `/oficina` has no auth (O-D4/O-D3): unlike every `/api/backoffice/*`
 * route, this one is NOT cookie-gated -- anyone with the `/oficina` URL can
 * subscribe. Documented and accepted for this demo (README); the only gate
 * on this unauthenticated input is `validarSuscripcion` (https endpoint,
 * bounded sizes).
 */
export async function POST(request: Request): Promise<Response> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400, headers: NO_STORE })
  }

  const validado = validarSuscripcion(json)
  if (!validado.ok) {
    return Response.json({ error: validado.error }, { status: 400, headers: NO_STORE })
  }

  try {
    await getPushSubscriptionStore().guardar(validado.data)
  } catch (err) {
    console.error("[oficina] guardar suscripción failed:", err)
    return Response.json(ERROR_INTERNO, { status: 500, headers: NO_STORE })
  }

  return Response.json({ ok: true }, { headers: NO_STORE })
}

/** DELETE /api/oficina/push/suscripcion (G7b): "Desactivar" -- removes the
 * subscription by endpoint. Idempotent: deleting an unknown endpoint is a
 * no-op 200, same rationale as FloorRepository#cerrarSesion. */
export async function DELETE(request: Request): Promise<Response> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400, headers: NO_STORE })
  }
  if (typeof json !== "object" || json === null) {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400, headers: NO_STORE })
  }
  const endpoint = (json as Record<string, unknown>).endpoint
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
