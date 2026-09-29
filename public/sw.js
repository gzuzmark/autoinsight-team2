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

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    }),
  )
})
