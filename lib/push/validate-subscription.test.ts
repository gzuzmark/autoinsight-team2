import { describe, expect, it } from "vitest"
import { validarSuscripcion } from "@/lib/push/validate-subscription"

const VALIDA = { endpoint: "https://push.example.com/abc", keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) } }

describe("validarSuscripcion", () => {
  it("accepts a well-formed https subscription", () => {
    expect(validarSuscripcion(VALIDA)).toEqual({ ok: true, data: VALIDA })
  })

  it("rejects a non-object body", () => {
    expect(validarSuscripcion(null).ok).toBe(false)
    expect(validarSuscripcion("string").ok).toBe(false)
  })

  it("rejects a non-https endpoint", () => {
    expect(validarSuscripcion({ ...VALIDA, endpoint: "http://push.example.com/abc" }).ok).toBe(false)
    expect(validarSuscripcion({ ...VALIDA, endpoint: "javascript:alert(1)" }).ok).toBe(false)
  })

  it("rejects a malformed endpoint URL", () => {
    expect(validarSuscripcion({ ...VALIDA, endpoint: "not a url" }).ok).toBe(false)
  })

  it("rejects an endpoint over the length limit", () => {
    expect(validarSuscripcion({ ...VALIDA, endpoint: "https://a.com/" + "x".repeat(3000) }).ok).toBe(false)
  })

  it("rejects missing or malformed keys", () => {
    expect(validarSuscripcion({ endpoint: VALIDA.endpoint }).ok).toBe(false)
    expect(validarSuscripcion({ ...VALIDA, keys: { p256dh: "p" } }).ok).toBe(false)
    expect(validarSuscripcion({ ...VALIDA, keys: { p256dh: "p", auth: "" } }).ok).toBe(false)
  })

  it("rejects a key over the length limit", () => {
    expect(
      validarSuscripcion({ ...VALIDA, keys: { ...VALIDA.keys, auth: "a".repeat(1000) } }).ok,
    ).toBe(false)
  })
})
