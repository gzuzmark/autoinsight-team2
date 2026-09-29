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
