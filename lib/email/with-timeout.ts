import type { EmailMessage, EmailSender } from "@/lib/email/sender"

/**
 * E2 (RDD review hotfix follow-up): bounds a slow/unresponsive
 * `EmailSender#send` overall. `GmailSmtpSender` already sets its own
 * Nodemailer socket-level timeouts (see its doc), but this is the
 * caller-side backstop for any `EmailSender` -- including a hung
 * implementation those transport timeouts cannot see -- so a caller that
 * must not fail its own operation on a delivery failure (e.g. POST
 * /api/backoffice/turno: "the shift already happened") also cannot be held
 * open indefinitely by one.
 */
export async function enviarConLimite(
  sender: EmailSender,
  message: EmailMessage,
  limiteMs = 10_000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Envío de correo: tiempo de espera agotado.")), limiteMs)
  })
  try {
    await Promise.race([sender.send(message), limite])
  } finally {
    clearTimeout(timer)
  }
}
