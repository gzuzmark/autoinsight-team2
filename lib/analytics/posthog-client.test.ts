import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * G8: thin, guarded wrapper around posthog-js (lib/analytics/posthog-client.ts).
 * Every method must be a no-op before `inicializarPosthog` has actually run
 * with a key (mock/test/CI/local-without-a-key, the default) -- this is the
 * "init guard" TDD requirement in the task brief.
 */

const init = vi.fn()
const capture = vi.fn()
const identify = vi.fn()
const reset = vi.fn()
const stopSessionRecording = vi.fn()

vi.mock("posthog-js", () => ({
  default: {
    init: (...args: unknown[]) => init(...args),
    capture: (...args: unknown[]) => capture(...args),
    identify: (...args: unknown[]) => identify(...args),
    reset: (...args: unknown[]) => reset(...args),
    stopSessionRecording: (...args: unknown[]) => stopSessionRecording(...args),
  },
}))

describe("posthog-client init guard", () => {
  beforeEach(() => {
    vi.resetModules()
    init.mockClear()
    capture.mockClear()
    identify.mockClear()
    reset.mockClear()
    stopSessionRecording.mockClear()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it("no key: never calls posthog.init, and every method stays a no-op", async () => {
    const mod = await import("@/lib/analytics/posthog-client")
    mod.inicializarPosthog({ key: undefined, host: "https://us.i.posthog.com" })
    expect(init).not.toHaveBeenCalled()
    expect(mod.posthogInicializado()).toBe(false)

    mod.capturarEvento({ name: "login", properties: { linea: "x" } })
    mod.identificarParticipante("P1")
    mod.reiniciarIdentidad()
    mod.detenerGrabacionSesion()

    expect(capture).not.toHaveBeenCalled()
    expect(identify).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
    expect(stopSessionRecording).not.toHaveBeenCalled()
  })

  it("with a key: initializes once, autocapture off, masks inputs, identified_only profiles", async () => {
    const mod = await import("@/lib/analytics/posthog-client")
    mod.inicializarPosthog({ key: "phc_test", host: "https://us.i.posthog.com" })
    mod.inicializarPosthog({ key: "phc_test", host: "https://us.i.posthog.com" })

    expect(init).toHaveBeenCalledTimes(1)
    const [key, options] = init.mock.calls[0] as [string, Record<string, unknown>]
    expect(key).toBe("phc_test")
    expect(options.api_host).toBe("https://us.i.posthog.com")
    expect(options.autocapture).toBe(false)
    expect(options.person_profiles).toBe("identified_only")
    expect((options.session_recording as { maskAllInputs?: boolean }).maskAllInputs).toBe(true)
    expect(mod.posthogInicializado()).toBe(true)
  })

  it("after init, capturarEvento/identificarParticipante/reiniciarIdentidad/detenerGrabacionSesion delegate", async () => {
    const mod = await import("@/lib/analytics/posthog-client")
    mod.inicializarPosthog({ key: "phc_test", host: "https://us.i.posthog.com" })

    mod.capturarEvento({ name: "login", properties: { linea: "x" } })
    expect(capture).toHaveBeenCalledWith("login", { linea: "x" })

    mod.identificarParticipante("P2", { linea: "Línea 3" })
    expect(identify).toHaveBeenCalledWith("P2", { linea: "Línea 3" })

    mod.reiniciarIdentidad()
    expect(reset).toHaveBeenCalledTimes(1)

    mod.detenerGrabacionSesion()
    expect(stopSessionRecording).toHaveBeenCalledTimes(1)
  })
})
