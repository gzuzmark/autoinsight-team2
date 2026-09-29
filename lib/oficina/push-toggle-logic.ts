/**
 * I-3 (RDD review G7b follow-up, 2026-09-29): pure decision logic behind
 * components/oficina/push-toggle.tsx, kept separate (like
 * lib/oficina/push-support.ts) so it is unit-testable without a
 * browser/service-worker environment.
 *
 * The component previously left the browser subscription live even when
 * the server POST failed (an orphan subscription: the UI showed
 * "Activadas" on the next load with no matching server row), never
 * re-checked an existing browser subscription against the server on load,
 * and ignored the DELETE response entirely. These helpers centralize what
 * message (if any) to show for each outcome; the component owns doing the
 * actual unsubscribe/re-sync I/O and calls these to decide what to
 * display.
 */

const ERROR_SERVIDOR_GENERICO = "error del servidor."

/** Message for a failed POST /api/oficina/push/suscripcion during
 * "Activar" -- the caller must then unsubscribe the just-created browser
 * subscription (this function only decides the message). The 429 cap
 * (SubscriptionLimitError, see lib/push/subscription-store.ts) gets its
 * own clear wording instead of echoing the generic server message. */
export function mensajeErrorActivar(status: number, errorServidor: string | null): string {
  if (status === 429) {
    return "No se pudo activar: se alcanzó el límite de suscripciones. Intenta más tarde."
  }
  return `No se pudo activar: ${errorServidor ?? ERROR_SERVIDOR_GENERICO}`
}

/** Push fix (a, 2026-09-29 "small push fixes" note): message for when the
 * service worker itself never became ready -- `register()` rejected, or
 * `navigator.serviceWorker.ready` never resolved to an active worker --
 * BEFORE `pushManager.subscribe()` could even run. Observed once in Zen: a
 * click on "Activar notificaciones" did nothing and the server never saw a
 * request. Deliberately distinct from mensajeErrorActivar's wording (that
 * one is for a real server response); this one means subscribe never had a
 * chance to run at all. */
export function mensajeErrorServiceWorker(): string {
  return "No se pudo activar: el navegador no pudo preparar las notificaciones. Probá de nuevo."
}

/** Message for a failed DELETE /api/oficina/push/suscripcion during
 * "Desactivar". The browser subscription is unsubscribed locally
 * regardless (see the component) -- this only decides the surfaced
 * message. */
export function mensajeErrorDesactivar(errorServidor: string | null): string {
  return `No se pudo desactivar en el servidor: ${errorServidor ?? ERROR_SERVIDOR_GENERICO}`
}

/** On-load re-sync outcome. The browser already has a subscription; the
 * component re-POSTs it as an upsert since the server row may be missing
 * (cleared by an admin, or a previous "Activar" whose browser subscribe
 * succeeded but server POST failed). Only a successful upsert may show
 * "activadas" -- a failed one surfaces an error instead of silently
 * claiming the subscription is active when the server does not have it. */
export function estadoTrasResincronizar(resyncOk: boolean): { estado: "activadas" | "error"; mensaje: string | null } {
  if (resyncOk) return { estado: "activadas", mensaje: null }
  return { estado: "error", mensaje: "No se pudo sincronizar la suscripción con el servidor." }
}

/** Reads `{ error?: string }` from a parsed response body, defensively --
 * the body may be null (unparsable JSON), not an object, or missing the
 * field entirely. */
export function extraerMensajeError(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null
  const error = (body as Record<string, unknown>).error
  return typeof error === "string" ? error : null
}
