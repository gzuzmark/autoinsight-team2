/**
 * G7b: pure helpers for the office "Activar notificaciones" button
 * (components/oficina/push-toggle.tsx). Kept separate from that client
 * component so the state-derivation and base64 conversion logic is
 * unit-testable without a browser/service-worker environment.
 */
export type EstadoNotificaciones =
  | "no-soportado"
  | "bloqueadas"
  | "inactivo"
  | "activando"
  | "activadas"
  | "desactivando"
  | "error"

/** Initial state from the browser's own signals: Notification API support
 * and the current permission. Never requests permission itself (that only
 * happens on the button click, per the brief -- "permission request on
 * click only, never on load"). */
export function estadoInicial(soportado: boolean, permiso: NotificationPermission | null): EstadoNotificaciones {
  if (!soportado) return "no-soportado"
  if (permiso === "denied") return "bloqueadas"
  return "inactivo"
}

/** VAPID public key (URL-safe base64, per the Web Push spec) -> the raw
 * Uint8Array `PushManager#subscribe`'s `applicationServerKey` needs. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export const ETIQUETA_ESTADO: Record<EstadoNotificaciones, string> = {
  "no-soportado": "No compatible con este navegador",
  bloqueadas: "Bloqueadas por el navegador",
  inactivo: "Activar notificaciones",
  activando: "Activando…",
  activadas: "Activadas",
  desactivando: "Desactivando…",
  error: "No se pudo activar. Reintentar",
}
