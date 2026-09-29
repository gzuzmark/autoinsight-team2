import type { EmailMessage, EmailSender } from "@/lib/email/sender"

/**
 * G6 fallback adapter: used whenever Gmail credentials (`GMAIL_USER` /
 * `GMAIL_APP_PASSWORD`) are missing, and always in tests (so a test never
 * needs real credentials or hits the network). Never throws: a report
 * email is a nice-to-have, never something that should break a caller that
 * has no SMTP configured (e.g. local dev with mock data).
 */
export class LogEmailSender implements EmailSender {
  readonly enviados: EmailMessage[] = []

  async send(message: EmailMessage): Promise<void> {
    this.enviados.push(message)
    try {
      console.log(
        `email skipped: not configured (subject: "${message.subject}", to: ${message.to.join(", ")})`,
      )
    } catch {
      // Logging itself failing (e.g. a broken console in some exotic
      // environment) must not turn a no-op fallback into a thrown error.
    }
  }
}
