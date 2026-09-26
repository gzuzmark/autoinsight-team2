import "server-only"

/**
 * Per-client-IP login throttle (D21). In-memory, per server instance: on
 * serverless (multiple instances, no shared state) this only bounds guesses
 * per instance, not globally -- documented limitation, see README. A real
 * multi-instance deployment would need a shared store (e.g. Redis); out of
 * scope here (no such store is provisioned).
 */

const MAX_ATTEMPTS = 10
const WINDOW_MS = 60_000

type Bucket = { count: number; windowStart: number }

const buckets = new Map<string, Bucket>()

/** Extracts the client identity to throttle on: the first hop of
 * `x-forwarded-for` (the original client, as set by the edge/proxy in front
 * of the app), or a single shared fallback bucket when the header is
 * absent (e.g. local dev without a proxy) -- documented as a limitation,
 * not a security boundary, in the README. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const first = forwarded?.split(",")[0]?.trim()
  return first && first.length > 0 ? first : "unknown-client"
}

/** Records one login attempt for `key` and returns whether it should be
 * throttled (true = reject with 429). Resets the window once it elapses. */
export function shouldThrottle(key: string, now: number = Date.now()): boolean {
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now })
    return false
  }
  bucket.count += 1
  return bucket.count > MAX_ATTEMPTS
}

/** Test-only: clears all throttle state between tests. */
export function resetThrottleForTests(): void {
  buckets.clear()
}
