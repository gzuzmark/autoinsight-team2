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
