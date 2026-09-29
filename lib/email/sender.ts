/**
 * G6: mailer port. Both adapters (`LogEmailSender`, `GmailSmtpSender`)
 * implement this so the callers (report-sending routes) never depend on
 * Nodemailer or Gmail directly -- swapping the provider later (Resend,
 * Brevo, ...) only means writing a new adapter, matching the decision in
 * odd/tasks/guerrilla-backoffice.md ("Decisions (user, 2026-09-28, after
 * G3)": "Sender code isolated behind a port").
 */
export type EmailMessage = {
  to: string[]
  subject: string
  html: string
  text: string
}

export interface EmailSender {
  /**
   * `GmailSmtpSender` can reject (a real SMTP failure); `LogEmailSender`
   * never does (see its own doc). Callers that must not fail their own
   * operation on a delivery failure (e.g. `POST /api/backoffice/turno` --
   * "an email failure must NOT fail the shift") catch this themselves and
   * map it to their own inline status instead of leaving it unhandled.
   */
  send(message: EmailMessage): Promise<void>
}
