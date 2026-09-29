import { describe, expect, it } from "vitest"
import { validarSuscripcion, endpointServicioPermitido } from "@/lib/push/validate-subscription"

const VALIDA = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) },
}

describe("validarSuscripcion", () => {
  it("accepts a well-formed https subscription on an allowlisted host", () => {
    expect(validarSuscripcion(VALIDA)).toEqual({ ok: true, data: VALIDA })
  })

  it("rejects a non-object body", () => {
    expect(validarSuscripcion(null).ok).toBe(false)
    expect(validarSuscripcion("string").ok).toBe(false)
  })

  it("rejects a non-https endpoint", () => {
    expect(validarSuscripcion({ ...VALIDA, endpoint: "http://fcm.googleapis.com/fcm/send/abc" }).ok).toBe(false)
    expect(validarSuscripcion({ ...VALIDA, endpoint: "javascript:alert(1)" }).ok).toBe(false)
  })

  it("rejects a malformed endpoint URL", () => {
    expect(validarSuscripcion({ ...VALIDA, endpoint: "not a url" }).ok).toBe(false)
  })

  it("rejects an endpoint over the length limit", () => {
    expect(validarSuscripcion({ ...VALIDA, endpoint: "https://fcm.googleapis.com/" + "x".repeat(3000) }).ok).toBe(
      false,
    )
  })

  it("rejects missing or malformed keys", () => {
    expect(validarSuscripcion({ endpoint: VALIDA.endpoint }).ok).toBe(false)
    expect(validarSuscripcion({ ...VALIDA, keys: { p256dh: "p" } }).ok).toBe(false)
    expect(validarSuscripcion({ ...VALIDA, keys: { p256dh: "p", auth: "" } }).ok).toBe(false)
  })

  it("rejects a key over the length limit", () => {
    expect(validarSuscripcion({ ...VALIDA, keys: { ...VALIDA.keys, auth: "a".repeat(1000) } }).ok).toBe(false)
  })

  it("rejects an endpoint on a host that is not on the push-service allowlist", () => {
    const res = validarSuscripcion({ ...VALIDA, endpoint: "https://push.example.com/abc" })
    expect(res.ok).toBe(false)
    expect((res as { ok: false; error: string }).error).toBe("endpoint no corresponde a un servicio de notificaciones admitido.")
  })
})

describe("endpointServicioPermitido (host allowlist)", () => {
  it("accepts each allowlisted push-service host", () => {
    expect(endpointServicioPermitido("https://fcm.googleapis.com/fcm/send/abc")).toBe(true)
    expect(endpointServicioPermitido("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true)
    expect(endpointServicioPermitido("https://web.push.apple.com/QQ")).toBe(true)
    expect(endpointServicioPermitido("https://xyz123.notify.windows.com/push/abc")).toBe(true)
  })

  it("rejects a host suffix lookalike (fcm.googleapis.com.evil.com)", () => {
    expect(endpointServicioPermitido("https://fcm.googleapis.com.evil.com/fcm/send/abc")).toBe(false)
  })

  it("rejects an unrelated host with the real host only in the path", () => {
    expect(endpointServicioPermitido("https://evil.com/fcm.googleapis.com")).toBe(false)
  })

  it("rejects userinfo smuggling a lookalike host", () => {
    expect(endpointServicioPermitido("https://fcm.googleapis.com@evil.com/x")).toBe(false)
    expect(endpointServicioPermitido("https://evil.com:pw@fcm.googleapis.com/x")).toBe(false)
  })

  it("rejects an explicit port on an otherwise allowlisted host", () => {
    expect(endpointServicioPermitido("https://fcm.googleapis.com:8443/fcm/send/abc")).toBe(false)
  })

  it("rejects http even on an allowlisted host", () => {
    expect(endpointServicioPermitido("http://fcm.googleapis.com/fcm/send/abc")).toBe(false)
  })

  it("rejects the bare notify.windows.com domain (allowlist is a subdomain wildcard)", () => {
    expect(endpointServicioPermitido("https://notify.windows.com/push/abc")).toBe(false)
  })

  it("rejects an unrelated but plausible-looking push host", () => {
    expect(endpointServicioPermitido("https://push.example.com/abc")).toBe(false)
  })

  it("rejects a malformed URL", () => {
    expect(endpointServicioPermitido("not a url")).toBe(false)
  })
})
