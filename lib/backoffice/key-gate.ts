import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Facilitator key gate for /backoffice (G1, D28 amendment). Fails closed: an
 * unset BACKOFFICE_KEY means the gate stays closed for every candidate, no
 * matter what is submitted -- never a bypass.
 */

const TOKEN_LABEL = "autoinsight-backoffice-session"

export function isBackofficeConfigured(): boolean {
  return typeof process.env.BACKOFFICE_KEY === "string" && process.env.BACKOFFICE_KEY.length > 0
}

/** Constant-time comparison of a submitted key against BACKOFFICE_KEY. A
 * length mismatch still runs a same-cost compare before returning, so the
 * mismatch itself is not an early, timing-observable exit. */
export function verifyKey(candidate: string): boolean {
  const expected = process.env.BACKOFFICE_KEY
  if (!expected) return false
  return constantTimeEquals(candidate, expected)
}

/** Derives the cookie's session token from BACKOFFICE_KEY via HMAC-SHA256:
 * the cookie holds this one-way derived value, never the raw key, so a
 * leaked cookie does not leak the facilitator key itself. */
export function deriveToken(key: string): string {
  return createHmac("sha256", key).update(TOKEN_LABEL).digest("hex")
}

/** The token a valid session cookie must currently hold, or null when
 * BACKOFFICE_KEY is unset (gate closed). */
export function currentToken(): string | null {
  const key = process.env.BACKOFFICE_KEY
  if (!key) return null
  return deriveToken(key)
}

/** Validates a cookie-supplied token against the current derived token
 * (constant-time). Fails closed on an unset key or a missing token, and
 * rejects a token derived from a since-rotated key. */
export function isValidToken(token: string | null): boolean {
  const expected = currentToken()
  if (!expected || !token) return false
  return constantTimeEquals(token, expected)
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) {
    // Compare same-length buffers anyway so a length mismatch costs the
    // same as a same-length wrong guess, instead of returning early.
    timingSafeEqual(bufB, bufB)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}
