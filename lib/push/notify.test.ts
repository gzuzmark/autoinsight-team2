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

describe("notificarAlertasAlta", () => {
  it("sends nothing when there are no ALTA alerts (MEDIA/BAJA are ignored)", async () => {
    const send = vi.fn()
    const sender: PushSender = { send }
    const store = fakeStore([SUB_A])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [MEDIA])
    expect(resultado).toEqual({ notificadas: 0, suscripcionesEliminadas: 0 })
    expect(send).not.toHaveBeenCalled()
  })

  it("sends one notification per ALTA alert to every subscription", async () => {
    const send = vi.fn(async () => {})
    const sender: PushSender = { send }
    const store = fakeStore([SUB_A, SUB_B])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA, MEDIA])
    expect(resultado.notificadas).toBe(2)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it("deletes a subscription whose send throws PushSubscriptionGoneError, and does not count it as notified", async () => {
    const send = vi.fn(async (sub: PushSubscriptionData) => {
      if (sub.endpoint === SUB_B.endpoint) throw new PushSubscriptionGoneError()
    })
    const sender: PushSender = { send }
    const store = fakeStore([SUB_A, SUB_B])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA])
    expect(resultado.notificadas).toBe(1)
    expect(resultado.suscripcionesEliminadas).toBe(1)
    expect(store.eliminar).toHaveBeenCalledWith(SUB_B.endpoint)
  })

  it("never throws when a non-Gone send failure occurs -- the caller's operation must not fail because of this", async () => {
    const send = vi.fn(async () => {
      throw new Error("network down")
    })
    const sender: PushSender = { send }
    const store = fakeStore([SUB_A])
    await expect(notificarAlertasAlta(sender, store, LINEA, [ALTA])).resolves.toEqual({
      notificadas: 0,
      suscripcionesEliminadas: 0,
    })
  })

  it("never throws when listing subscriptions fails", async () => {
    const sender: PushSender = { send: vi.fn() }
    const store: PushSubscriptionStore = {
      listar: vi.fn(async () => {
        throw new Error("db down")
      }),
      eliminar: vi.fn(),
      guardar: vi.fn(),
    }
    await expect(notificarAlertasAlta(sender, store, LINEA, [ALTA])).resolves.toEqual({
      notificadas: 0,
      suscripcionesEliminadas: 0,
    })
  })

  it("does nothing when there are no stored subscriptions", async () => {
    const send = vi.fn()
    const sender: PushSender = { send }
    const store = fakeStore([])
    await notificarAlertasAlta(sender, store, LINEA, [ALTA])
    expect(send).not.toHaveBeenCalled()
  })

  it("skips and deletes a subscription whose endpoint is not on the push-service allowlist, without sending", async () => {
    const send = vi.fn(async () => {})
    const sender: PushSender = { send }
    const store = fakeStore([SUB_A, SUB_NO_PERMITIDA])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA])
    expect(resultado.notificadas).toBe(1)
    expect(resultado.suscripcionesEliminadas).toBe(1)
    expect(store.eliminar).toHaveBeenCalledWith(SUB_NO_PERMITIDA.endpoint)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(SUB_A, expect.anything())
  })

  it("sends nothing and reports no notifications when every stored subscription fails the allowlist", async () => {
    const send = vi.fn()
    const sender: PushSender = { send }
    const store = fakeStore([SUB_NO_PERMITIDA])
    const resultado = await notificarAlertasAlta(sender, store, LINEA, [ALTA])
    expect(resultado).toEqual({ notificadas: 0, suscripcionesEliminadas: 1 })
    expect(send).not.toHaveBeenCalled()
  })
})
