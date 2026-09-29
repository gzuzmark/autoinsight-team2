import { describe, expect, it, vi } from "vitest"

const sendNotification = vi.fn()
const setVapidDetails = vi.fn()

class FakeWebPushError extends Error {
  statusCode: number
  constructor(statusCode: number) {
    super("gone")
    this.statusCode = statusCode
  }
}

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
    WebPushError: FakeWebPushError,
  },
}))

const SUB = { endpoint: "https://push.example.com/abc", keys: { p256dh: "p", auth: "a" } }
const PAYLOAD = { title: "Alerta ALTA", body: "body", tag: "t", url: "/oficina/alertas/1" }

describe("WebPushSender", () => {
  it("configures VAPID details on construction", async () => {
    const { WebPushSender } = await import("@/lib/push/webpush-sender")
    new WebPushSender("pub", "priv", "mailto:a@b.com")
    expect(setVapidDetails).toHaveBeenCalledWith("mailto:a@b.com", "pub", "priv")
  })

  it("sends the subscription and JSON-encoded payload", async () => {
    sendNotification.mockResolvedValueOnce(undefined)
    const { WebPushSender } = await import("@/lib/push/webpush-sender")
    const sender = new WebPushSender("pub", "priv", "mailto:a@b.com")
    await sender.send(SUB, PAYLOAD)
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: SUB.endpoint, keys: SUB.keys },
      JSON.stringify(PAYLOAD),
    )
  })

  it("maps a 404/410 push-service response to PushSubscriptionGoneError", async () => {
    const { WebPushSender } = await import("@/lib/push/webpush-sender")
    const { PushSubscriptionGoneError } = await import("@/lib/push/sender")
    const sender = new WebPushSender("pub", "priv", "mailto:a@b.com")

    sendNotification.mockRejectedValueOnce(new FakeWebPushError(410))
    await expect(sender.send(SUB, PAYLOAD)).rejects.toBeInstanceOf(PushSubscriptionGoneError)

    sendNotification.mockRejectedValueOnce(new FakeWebPushError(404))
    await expect(sender.send(SUB, PAYLOAD)).rejects.toBeInstanceOf(PushSubscriptionGoneError)
  })

  it("rethrows any other failure as-is", async () => {
    const { WebPushSender } = await import("@/lib/push/webpush-sender")
    const sender = new WebPushSender("pub", "priv", "mailto:a@b.com")
    sendNotification.mockRejectedValueOnce(new FakeWebPushError(500))
    await expect(sender.send(SUB, PAYLOAD)).rejects.toThrow("gone")
  })
})
