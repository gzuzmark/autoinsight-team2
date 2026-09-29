import type { PushPayload, PushSender, PushSubscriptionData } from "@/lib/push/sender"

/**
 * Caller-side bound on one `PushSender#send` call, same rationale as
 * lib/email/with-timeout.ts (G6/E2): a hung push-service request must not
 * hold a caller (the "Simular turno"/"Enviar correo ahora" style trigger)
 * open indefinitely.
 */
export async function enviarPushConLimite(
  sender: PushSender,
  subscription: PushSubscriptionData,
  payload: PushPayload,
  limiteMs = 8_000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Envío de push: tiempo de espera agotado.")), limiteMs)
  })
  try {
    await Promise.race([sender.send(subscription, payload), limite])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * L-3 (RDD review K/push/G9/J follow-up, 2026-09-29): generic caller-side
 * race-with-timeout, same shape as `enviarPushConLimite` above but for any
 * promise. components/oficina/push-toggle.tsx uses this to bound
 * `navigator.serviceWorker.ready`, which previously had no timeout at all --
 * a service worker that never activates left the toggle stuck on
 * "Activando..." forever, with no way for the user to recover short of
 * reloading the page.
 */
export async function conLimite<T>(promesa: Promise<T>, limiteMs: number, mensajeTimeout: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(mensajeTimeout)), limiteMs)
  })
  try {
    return await Promise.race([promesa, limite])
  } finally {
    clearTimeout(timer)
  }
}
