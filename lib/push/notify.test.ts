import { describe, expect, it, vi } from "vitest"
import { notificarAlertasAlta } from "@/lib/push/notify"
import { PushSubscriptionGoneError, type PushSender, type PushSubscriptionData } from "@/lib/push/sender"
import type { PushSubscriptionStore } from "@/lib/push/subscription-store"
import type { Alerta } from "@/lib/mock-data"

const LINEA = "Línea 3 · Motores" as const
const ALTA: Alerta = { id: "a1", severidad: "parar", titulo: "Torque", estacion: "E7", timestamp: 1, estado: "nueva" }
const MEDIA: Alerta = { id: "a2", severidad: "atencion", titulo: "Scrap", estacion: "E3", timestamp: 1, estado: "nueva" }
const SUB_A: PushSubscriptionData = { endpoint: "https://fcm.googleapis.com/fcm/send/a", keys: { p256dh: "p", auth: "a" } }
const SUB_B: PushSubscriptionData = {
  endpoint: "https://updates.push.services.mozilla.com/wpush/v2/b",
  keys: { p256dh: "p", auth: "a" },
}
const SUB_NO_PERMITIDA: PushSubscriptionData = { endpoint: "https://evil.com/x", keys: { p256dh: "p", auth: "a" } }

function fakeStore(subs: PushSubscriptionData[]): PushSubscriptionStore {
  return {
    listar: vi.fn(async () => subs),
    eliminar: vi.fn(async () => {}),
    guardar: vi.fn(async () => {}),
  }
}

function subsFcm(n: number): PushSubscriptionData[] {
  return Array.from({ length: n }, (_, i) => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/${i}`,
    keys: { p256dh: "p", auth: "a" },
  }))
}

describe("notificarAlertasAlta", () => {
  it("sends nothing when there are no ALTA alerts (MEDIA/BAJA are ignored)", async () => {
    const send = vi.fn()
    const sender: PushSender = { send }
    const store = fakeStore([SUB_A])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [MEDIA])
    expect(resultado).toEqual({ intentadas: 0, entregadas: 0, fallidas: 0, suscripcionesEliminadas: 0, listadoFallo: false })
    expect(send).not.toHaveBeenCalled()
  })

  it("sends one notification per ALTA alert to every subscription and reports an honest result", async () => {
    const send = vi.fn(async () => {})
    const sender: PushSender = { send }
    const store = fakeStore([SUB_A, SUB_B])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA, MEDIA])
    expect(resultado).toEqual({ intentadas: 2, entregadas: 2, fallidas: 0, suscripcionesEliminadas: 0, listadoFallo: false })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it("deletes a subscription whose send throws PushSubscriptionGoneError, and counts it as a failed attempt", async () => {
    const send = vi.fn(async (sub: PushSubscriptionData) => {
      if (sub.endpoint === SUB_B.endpoint) throw new PushSubscriptionGoneError()
    })
    const sender: PushSender = { send }
    const store = fakeStore([SUB_A, SUB_B])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA])
    expect(resultado.intentadas).toBe(2)
    expect(resultado.entregadas).toBe(1)
    expect(resultado.fallidas).toBe(1)
    expect(resultado.suscripcionesEliminadas).toBe(1)
    expect(store.eliminar).toHaveBeenCalledWith(SUB_B.endpoint)
  })

  it("never throws when a non-Gone send failure occurs, and reports it as a failed attempt (not silently zero)", async () => {
    const send = vi.fn(async () => {
      throw new Error("network down")
    })
    const sender: PushSender = { send }
    const store = fakeStore([SUB_A])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA])
    expect(resultado).toEqual({ intentadas: 1, entregadas: 0, fallidas: 1, suscripcionesEliminadas: 0, listadoFallo: false })
  })

  it("never throws when listing subscriptions fails, and reports listadoFallo so the caller can tell the difference", async () => {
    const sender: PushSender = { send: vi.fn() }
    const store: PushSubscriptionStore = {
      listar: vi.fn(async () => {
        throw new Error("db down")
      }),
      eliminar: vi.fn(),
      guardar: vi.fn(),
    }
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA])
    expect(resultado).toEqual({ intentadas: 0, entregadas: 0, fallidas: 0, suscripcionesEliminadas: 0, listadoFallo: true })
  })

  it("does nothing when there are no stored subscriptions (not a listing failure)", async () => {
    const send = vi.fn()
    const sender: PushSender = { send }
    const store = fakeStore([])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA])
    expect(send).not.toHaveBeenCalled()
    expect(resultado.listadoFallo).toBe(false)
    expect(resultado.intentadas).toBe(0)
  })

  it("skips and deletes a subscription whose endpoint is not on the push-service allowlist, without sending or counting it as attempted", async () => {
    const send = vi.fn(async () => {})
    const sender: PushSender = { send }
    const store = fakeStore([SUB_A, SUB_NO_PERMITIDA])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA])
    expect(resultado.intentadas).toBe(1)
    expect(resultado.entregadas).toBe(1)
    expect(resultado.suscripcionesEliminadas).toBe(1)
    expect(store.eliminar).toHaveBeenCalledWith(SUB_NO_PERMITIDA.endpoint)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(SUB_A, expect.anything())
  })

  it("sends nothing and reports no attempts when every stored subscription fails the allowlist", async () => {
    const send = vi.fn()
    const sender: PushSender = { send }
    const store = fakeStore([SUB_NO_PERMITIDA])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA])
    expect(resultado).toEqual({ intentadas: 0, entregadas: 0, fallidas: 0, suscripcionesEliminadas: 1, listadoFallo: false })
    expect(send).not.toHaveBeenCalled()
  })

  it("I-2: fans sends out in parallel (bounded concurrency), not one at a time", async () => {
    const enVuelo = { actual: 0, maximoObservado: 0 }
    const send = vi.fn(async () => {
      enVuelo.actual++
      enVuelo.maximoObservado = Math.max(enVuelo.maximoObservado, enVuelo.actual)
      await Promise.resolve()
      enVuelo.actual--
    })
    const sender: PushSender = { send }
    const store = fakeStore(subsFcm(20))
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA])
    expect(resultado.entregadas).toBe(20)
    // Sequential (one-at-a-time) fan-out would never observe more than 1
    // in flight at once -- bounded concurrency must observe more.
    expect(enVuelo.maximoObservado).toBeGreaterThan(1)
  })

  it("I-2: never waits longer than the total fan-out budget, even with a never-resolving sender and a subscription count that would take far longer sequentially", async () => {
    vi.useFakeTimers()
    try {
      const send = vi.fn(() => new Promise<void>(() => {})) // never resolves
      const sender: PushSender = { send }
      // 200 subscriptions * 8s per-send timeout, one at a time, would be
      // ~1600s -- the total budget below must cut this off far earlier.
      const store = fakeStore(subsFcm(200))
      const promesa = notificarAlertasAlta(sender, store, LINEA, [ALTA], { presupuestoTotalMs: 10_000 })
      await vi.advanceTimersByTimeAsync(10_000)
      const resultado = await promesa
      // Never fully delivered (sender never resolves) but the call itself
      // returned within the budget instead of hanging.
      expect(resultado.entregadas).toBe(0)
      expect(resultado.intentadas).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
