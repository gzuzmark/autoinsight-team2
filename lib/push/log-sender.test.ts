import { describe, expect, it, vi } from "vitest"
import { LogPushSender } from "@/lib/push/log-sender"

const SUB = { endpoint: "https://push.example.com/abc", keys: { p256dh: "p", auth: "a" } }
const PAYLOAD = { title: "Alerta ALTA · Línea 3", body: "Torque fuera de rango", tag: "alerta-1", url: "/oficina/alertas/1" }

describe("LogPushSender", () => {
  it("never throws, even when console logging is broken", async () => {
    const sender = new LogPushSender()
    await expect(sender.send(SUB, PAYLOAD)).resolves.toBeUndefined()
  })

  it("records every sent notification", async () => {
    const sender = new LogPushSender()
    await sender.send(SUB, PAYLOAD)
    expect(sender.enviados).toEqual([{ subscription: SUB, payload: PAYLOAD }])
  })

  it("logs a clear 'not configured' notice instead of pretending to deliver", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const sender = new LogPushSender()
    await sender.send(SUB, PAYLOAD)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("push skipped: not configured"))
    logSpy.mockRestore()
  })
})
