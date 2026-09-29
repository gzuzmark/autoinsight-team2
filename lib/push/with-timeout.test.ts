import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { conLimite } from "@/lib/push/with-timeout"

// L-3 (RDD review K/push/G9/J follow-up, 2026-09-29): components/oficina/
// push-toggle.tsx awaited `navigator.serviceWorker.ready` with no bound --
// a worker that never activates hangs the toggle on "Activando..." forever.
// `conLimite` is the generic caller-side race-with-timeout used to bound it
// (same shape as `enviarPushConLimite` above, generalized to any promise).
describe("conLimite", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("resolves with the wrapped promise's value when it settles before the limit", async () => {
    const promesa = Promise.resolve("listo")
    await expect(conLimite(promesa, 10_000, "tiempo de espera agotado")).resolves.toBe("listo")
  })

  it("rejects with the timeout message once the limit elapses and the promise never settles", async () => {
    const nuncaSeResuelve = new Promise<string>(() => {})
    const resultado = conLimite(nuncaSeResuelve, 10_000, "tiempo de espera agotado")
    const expectacion = expect(resultado).rejects.toThrow("tiempo de espera agotado")
    await vi.advanceTimersByTimeAsync(10_000)
    await expectacion
  })

  it("propagates the wrapped promise's own rejection instead of the timeout when it rejects first", async () => {
    const rechazaTemprano = Promise.reject(new Error("registro falló"))
    rechazaTemprano.catch(() => {}) // avoid an unhandled-rejection warning from the source promise itself
    await expect(conLimite(rechazaTemprano, 10_000, "tiempo de espera agotado")).rejects.toThrow("registro falló")
  })
})
