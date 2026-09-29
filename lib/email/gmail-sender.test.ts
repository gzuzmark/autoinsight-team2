import { describe, expect, it, vi } from "vitest"

const sendMail = vi.fn().mockResolvedValue(undefined)
const createTransport = vi.fn((_options: unknown) => ({ sendMail }))

vi.mock("nodemailer", () => ({
  default: { createTransport: (options: unknown) => createTransport(options) },
}))

/**
 * E2 (RDD review hotfix follow-up): a Nodemailer transport with no explicit
 * timeouts inherits its multi-minute defaults, so a slow/unreachable
 * smtp.gmail.com can hold a caller open far longer than acceptable for an
 * interactive "Simular turno"/"Enviar correo ahora" request. Asserts the
 * transport is built with explicit, bounded timeouts.
 */
describe("GmailSmtpSender", () => {
  it("configures explicit connection/greeting/socket timeouts", async () => {
    const { GmailSmtpSender } = await import("@/lib/email/gmail-sender")
    new GmailSmtpSender("user@gmail.com", "app-password")

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 5_000,
        greetingTimeout: 5_000,
        socketTimeout: 10_000,
      }),
    )
  })
})
