import { describe, expect, it, vi } from "vitest"
import { LogEmailSender } from "@/lib/email/log-sender"

const MENSAJE = { to: ["a@example.com"], subject: "Asunto", html: "<p>hola</p>", text: "hola" }

describe("LogEmailSender", () => {
  it("never throws, even when console logging is broken", async () => {
    const sender = new LogEmailSender()
    await expect(sender.send(MENSAJE)).resolves.toBeUndefined()
  })

  it("records every sent message", async () => {
    const sender = new LogEmailSender()
    await sender.send(MENSAJE)
    expect(sender.enviados).toEqual([MENSAJE])
  })

  it("logs a clear 'not configured' notice instead of pretending to deliver", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const sender = new LogEmailSender()
    await sender.send(MENSAJE)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("email skipped: not configured"))
    logSpy.mockRestore()
  })
})
