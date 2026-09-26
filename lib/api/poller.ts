/**
 * D29/E4: pure polling controller, extracted from React so it can be
 * unit-tested with fake timers instead of only through a rendered
 * component. `AppProvider` wires it to `document.visibilityState` and
 * `visibilitychange`; this module knows nothing about the DOM or React.
 */

export type PollerOptions = {
  /** Interval between ticks while visible, in ms (15_000 for D29). */
  intervalMs: number
  /** Called on every tick that is allowed to run (visible, not already
   * in flight). May reject; the poller swallows nothing -- the caller's
   * `onTick` is responsible for its own error handling (e.g. logging out
   * on a 401), same as it would be for a plain `fetch`. */
  onTick: () => Promise<void>
  /** Whether a tick should run right now. Checked at the start of every
   * tick, including the one `notifyVisible()` triggers. */
  isVisible: () => boolean
}

export type Poller = {
  /** Starts the interval. No-op if already started. */
  start: () => void
  /** Clears the interval. Safe to call multiple times / before start. */
  stop: () => void
  /** Call when the page becomes visible again (e.g. a `visibilitychange`
   * listener): refetches immediately instead of waiting up to
   * `intervalMs` for the next scheduled tick. No-op while stopped, while
   * hidden (per `isVisible`), or while a tick is already in flight. */
  notifyVisible: () => void
}

/** Creates a poller that is not yet running; call `start()` to begin. */
export function createPoller({ intervalMs, onTick, isVisible }: PollerOptions): Poller {
  let timer: ReturnType<typeof setInterval> | null = null
  // No overlapping requests (D29): a tick that finds one already running
  // (from the interval or from notifyVisible) is skipped entirely, not
  // queued -- the next scheduled tick will simply try again.
  let enVuelo = false

  async function tick(): Promise<void> {
    if (enVuelo) return
    if (!isVisible()) return
    enVuelo = true
    try {
      await onTick()
    } finally {
      enVuelo = false
    }
  }

  function start(): void {
    if (timer !== null) return
    timer = setInterval(() => {
      void tick()
    }, intervalMs)
  }

  function stop(): void {
    if (timer === null) return
    clearInterval(timer)
    timer = null
  }

  function notifyVisible(): void {
    if (timer === null) return
    void tick()
  }

  return { start, stop, notifyVisible }
}
