import { afterEach, describe, expect, it, vi } from "vitest"
import { currentToken, deriveToken, isBackofficeConfigured, isValidToken, verifyKey } from "./key-gate"

// G1: the facilitator key gate must fail closed whenever BACKOFFICE_KEY is
// unset, and must never leak the raw key into the derived session token.

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("isBackofficeConfigured", () => {
  it("is false when BACKOFFICE_KEY is unset", () => {
    vi.stubEnv("BACKOFFICE_KEY", "")
    expect(isBackofficeConfigured()).toBe(false)
  })

  it("is true when BACKOFFICE_KEY is a non-empty string", () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    expect(isBackofficeConfigured()).toBe(true)
  })
})

describe("verifyKey (constant-time)", () => {
  it("returns true for the exact configured key", () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    expect(verifyKey("dev-facilitador")).toBe(true)
  })

  it("returns false for a wrong key", () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    expect(verifyKey("wrong-key")).toBe(false)
  })

  it("returns false for a candidate of a different length than the configured key", () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    expect(verifyKey("short")).toBe(false)
  })

  it("fails closed: returns false for any candidate when BACKOFFICE_KEY is unset", () => {
    vi.stubEnv("BACKOFFICE_KEY", "")
    expect(verifyKey("")).toBe(false)
    expect(verifyKey("anything")).toBe(false)
  })

  it("is case-sensitive", () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    expect(verifyKey("DEV-FACILITADOR")).toBe(false)
  })
})

describe("deriveToken", () => {
  it("is deterministic for the same key", () => {
    expect(deriveToken("dev-facilitador")).toBe(deriveToken("dev-facilitador"))
  })

  it("differs for different keys", () => {
    expect(deriveToken("dev-facilitador")).not.toBe(deriveToken("other-key"))
  })

  it("never returns the raw key itself", () => {
    const token = deriveToken("dev-facilitador")
    expect(token).not.toBe("dev-facilitador")
    expect(token).not.toContain("dev-facilitador")
  })

  it("looks like a hex digest, not a plaintext echo", () => {
    expect(deriveToken("dev-facilitador")).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe("currentToken", () => {
  it("is null when BACKOFFICE_KEY is unset", () => {
    vi.stubEnv("BACKOFFICE_KEY", "")
    expect(currentToken()).toBeNull()
  })

  it("equals deriveToken(BACKOFFICE_KEY) when configured", () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    expect(currentToken()).toBe(deriveToken("dev-facilitador"))
  })
})

describe("isValidToken", () => {
  it("returns true for the current derived token", () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    expect(isValidToken(deriveToken("dev-facilitador"))).toBe(true)
  })

  it("returns false for a stale token derived from a rotated key", () => {
    const stale = deriveToken("old-key")
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    expect(isValidToken(stale)).toBe(false)
  })

  it("returns false for null", () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    expect(isValidToken(null)).toBe(false)
  })

  it("fails closed when BACKOFFICE_KEY is unset, even with a token that was valid before", () => {
    const token = (() => {
      vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
      return deriveToken("dev-facilitador")
    })()
    vi.stubEnv("BACKOFFICE_KEY", "")
    expect(isValidToken(token)).toBe(false)
  })
})
