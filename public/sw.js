// G7b: office Web Push service worker. Plain JS (no bundler -- Next serves
// public/** as-is): the payload -> notification-options and
// notification-data -> url mappings below mirror the pure, unit-tested
// helpers in lib/push/sw-helpers.ts (payloadANotificacion/urlDeNotificacion)
// verbatim -- keep them in sync by hand if either changes.

const TITULO_POR_DEFECTO = "AutoInsight"
const URL_POR_DEFECTO = "/oficina"

self.addEventListener("push", (event) => {
  let payload = {}
  if (event.data) {
    try {
      payload = event.data.json()
    } catch {
      payload = {}
    }
  }

  const titulo = payload.title || TITULO_POR_DEFECTO
  const opciones = {
    body: payload.body || "",
    tag: payload.tag || TITULO_POR_DEFECTO,
    data: { url: payload.url || URL_POR_DEFECTO },
  }

  event.waitUntil(self.registration.showNotification(titulo, opciones))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const data = event.notification.data
  const url =
    data && typeof data === "object" && typeof data.url === "string" && data.url.length > 0
      ? data.url
      : URL_POR_DEFECTO

  // G8: `url` may carry a `?origen=push` query flag (construirPayloadAlerta,
  // lib/push/payload.ts) that an already-open "plain" tab on the same alert
  // never has in its own address -- strip it before the match check only
  // (mirrors lib/push/sw-helpers.ts#rutaParaCoincidenciaCliente verbatim);
  // openWindow below still uses the full, unstripped url so the flag
  // reaches the page for its notificacion_click/oficina_alerta_abierta
  // capture.
  const rutaParaCoincidencia = url.split("?")[0]

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(rutaParaCoincidencia) && "focus" in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    }),
  )
})
