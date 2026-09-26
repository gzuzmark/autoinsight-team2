import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createPoller } from "./poller"

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createPoller", () => {
  it("does not tick before start()", () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    createPoller({ intervalMs: 15_000, onTick, isVisible: () => true })
    vi.advanceTimersByTime(60_000)
    expect(onTick).not.toHaveBeenCalled()
  })

  it("ticks every intervalMs while visible", async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const poller = createPoller({ intervalMs: 15_000, onTick, isVisible: () => true })
    poller.start()

    await vi.advanceTimersByTimeAsync(15_000)
    expect(onTick).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(15_000)
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it("stop() clears the interval", async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const poller = createPoller({ intervalMs: 15_000, onTick, isVisible: () => true })
    poller.start()
    poller.stop()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(onTick).not.toHaveBeenCalled()
  })

  it("stop() is safe to call before start() or twice", () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const poller = createPoller({ intervalMs: 15_000, onTick, isVisible: () => true })
    expect(() => {
      poller.stop()
      poller.start()
      poller.stop()
      poller.stop()
    }).not.toThrow()
  })

  it("skips a tick while hidden (Page Visibility API)", async () => {
    let visible = false
    const onTick = vi.fn().mockResolvedValue(undefined)
    const poller = createPoller({ intervalMs: 15_000, onTick, isVisible: () => visible })
    poller.start()

    await vi.advanceTimersByTimeAsync(15_000)
    expect(onTick).not.toHaveBeenCalled()

    visible = true
    await vi.advanceTimersByTimeAsync(15_000)
    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it("notifyVisible() ticks immediately instead of waiting for the next interval", async () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const poller = createPoller({ intervalMs: 15_000, onTick, isVisible: () => true })
    poller.start()

    await vi.advanceTimersByTimeAsync(5_000) // well before the first scheduled tick
    poller.notifyVisible()
    await vi.waitFor(() => expect(onTick).toHaveBeenCalledTimes(1))
  })

  it("notifyVisible() is a no-op before start()", () => {
    const onTick = vi.fn().mockResolvedValue(undefined)
    const poller = createPoller({ intervalMs: 15_000, onTick, isVisible: () => true })
    poller.notifyVisible()
    expect(onTick).not.toHaveBeenCalled()
  })

  it("never overlaps: a slow tick blocks the next scheduled tick until it resolves", async () => {
    const pending: { resolve?: () => void } = {}
    const onTick = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          pending.resolve = resolve
        }),
    )
    const poller = createPoller({ intervalMs: 15_000, onTick, isVisible: () => true })
    poller.start()

    await vi.advanceTimersByTimeAsync(15_000)
    expect(onTick).toHaveBeenCalledTimes(1)

    // The second scheduled tick fires while the first is still pending: it
    // must be skipped, not queued behind it.
    await vi.advanceTimersByTimeAsync(15_000)
    expect(onTick).toHaveBeenCalledTimes(1)

    pending.resolve?.()
    await vi.waitFor(() => {}) // let the microtask queue flush enVuelo := false

    await vi.advanceTimersByTimeAsync(15_000)
    expect(onTick).toHaveBeenCalledTimes(2)
  })
})
