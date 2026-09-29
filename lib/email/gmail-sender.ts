import "server-only"

import nodemailer, { type Transporter } from "nodemailer"
import type { EmailMessage, EmailSender } from "@/lib/email/sender"

/**
 * G6: Gmail SMTP adapter (`GMAIL_USER` / `GMAIL_APP_PASSWORD` -- an app
 * password, see the README's "Shift report email" section for how to
 * create one; needs 2-Step Verification on the Gmail account). Server-only:
 * this must never end up in a client bundle (it never runs there anyway --
 * only backoffice route handlers construct it -- but `import "server-only"`
 * fails the build loudly instead of silently shipping nothing).
 *
 * Unlike `LogEmailSender`, this CAN reject (a real SMTP failure): callers
 * that must not fail their own operation on a delivery failure catch it
 * themselves (see `EmailSender#send`'s doc).
 */
export class GmailSmtpSender implements EmailSender {
  private readonly transporter: Transporter
  private readonly from: string

  constructor(user: string, appPassword: string) {
    this.from = user
    this.transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass: appPassword },
      // E2 (RDD review hotfix follow-up): Nodemailer's own defaults run into
      // multiple minutes, which would hold an interactive "Simular turno" /
      // "Enviar correo ahora" request open far too long against a
      // slow/unreachable smtp.gmail.com. connectionTimeout/greetingTimeout
      // (5s each) cover the TCP connect and the SMTP greeting; socketTimeout
      // (10s) bounds inactivity during the rest of the exchange (AUTH, DATA).
      // These are the fast-fail floor; the caller (POST /api/backoffice/turno)
      // adds its own overall bound on top (see lib/email/with-timeout.ts) for
      // failure modes these transport-level timeouts do not cover.
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    })
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to.join(", "),
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
  }
}
