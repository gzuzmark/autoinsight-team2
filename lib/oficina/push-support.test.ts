import { describe, expect, it } from "vitest"
import { estadoInicial, urlBase64ToUint8Array } from "@/lib/oficina/push-support"

describe("estadoInicial", () => {
  it("returns 'no-soportado' when the browser has no Notification API", () => {
    expect(estadoInicial(false, null)).toBe("no-soportado")
  })

  it("returns 'bloqueadas' when permission was already denied", () => {
    expect(estadoInicial(true, "denied")).toBe("bloqueadas")
  })

  it("returns 'inactivo' for 'default' or 'granted' permission (never auto-subscribes)", () => {
    expect(estadoInicial(true, "default")).toBe("inactivo")
    expect(estadoInicial(true, "granted")).toBe("inactivo")
  })
})

describe("urlBase64ToUint8Array", () => {
  it("decodes a URL-safe base64 VAPID public key into the expected byte length", () => {
    // A 65-byte uncompressed EC point (the real shape a VAPID public key
    // has) base64url-encoded -- same shape web-push's own generateVAPIDKeys
    // produces (see lib/push/get-push-sender.test.ts).
    const bytes = new Uint8Array(65).fill(4)
    const base64url = Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    const decoded = urlBase64ToUint8Array(base64url)
    expect(decoded.length).toBe(65)
    expect(Array.from(decoded)).toEqual(Array.from(bytes))
  })
})
