/**
 * G7b: pure helpers for public/sw.js's `push`/`notificationclick` handlers.
 * A service worker script is plain JS with no bundler (Next serves
 * public/** as-is) -- the actual logic below is duplicated verbatim in
 * public/sw.js (see its comments pointing back here), but living here too
 * means it is unit-testable, per the brief's "extract pure helpers
 * (payload -> notification options/url) and unit-test them" instruction.
 */

export type PayloadNotificacion = { title?: string; body?: string; tag?: string; url?: string }

export type OpcionesNotificacion = { body: string; tag: string; data: { url: string } }

const TITULO_POR_DEFECTO = "AutoInsight"
const URL_POR_DEFECTO = "/oficina"

/** `push` handler: raw payload (whatever construirPayloadAlerta sent, or a
 * missing/malformed field from an unexpected sender) -> showNotification
 * title + options. Every field degrades to a safe default instead of
 * throwing inside the service worker. */
export function payloadANotificacion(payload: PayloadNotificacion): { titulo: string; opciones: OpcionesNotificacion } {
  return {
    titulo: payload.title || TITULO_POR_DEFECTO,
    opciones: {
      body: payload.body || "",
      tag: payload.tag || TITULO_POR_DEFECTO,
      data: { url: payload.url || URL_POR_DEFECTO },
    },
  }
}

/** `notificationclick` handler: a clicked notification's `data` -> the URL
 * to focus/open. Anything that is not the expected shape degrades to the
 * office root instead of throwing. */
export function urlDeNotificacion(data: unknown): string {
  if (typeof data === "object" && data !== null && "url" in data) {
    const url = (data as { url: unknown }).url
    if (typeof url === "string" && url.length > 0) return url
  }
  return URL_POR_DEFECTO
}
