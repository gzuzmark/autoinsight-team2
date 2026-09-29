import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { currentToken } from "@/lib/backoffice/key-gate"
import { BACKOFFICE_COOKIE_NAME } from "@/lib/api/backoffice-cookie"
import { resetEmailSenderForTests, setEmailSenderForTests } from "@/lib/email/get-email-sender"
import { LogEmailSender } from "@/lib/email/log-sender"
import type { EmailSender } from "@/lib/email/sender"
import { resetPushSenderForTests, setPushSenderForTests } from "@/lib/push/get-push-sender"
import { LogPushSender } from "@/lib/push/log-sender"
import { setPushSubscriptionStoreForTests } from "@/lib/push-subscription-store"
import { InMemoryPushSubscriptionStore } from "@/lib/push/in-memory-subscription-store"
import { POST } from "./route"

function req(body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (cookie) headers.cookie = `${BACKOFFICE_COOKIE_NAME}=${cookie}`
  return new Request("http://localhost/api/backoffice/turno", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

describe("POST /api/backoffice/turno", () => {
  let repo: InMemoryFloorRepository

  beforeEach(() => {
    repo = new InMemoryFloorRepository()
    setFloorRepositoryForTests(repo)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    resetEmailSenderForTests()
    resetPushSenderForTests()
  })

  it("fails closed with 503 when BACKOFFICE_KEY is unset", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "")
    const res = await POST(req({ linea: "Línea 3 · Motores" }, "anything"))
    expect(res.status).toBe(503)
  })

  it("returns 401 with no valid cookie", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const res = await POST(req({ linea: "Línea 3 · Motores" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 for a missing/unknown línea", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    const res = await POST(req({ linea: "Línea inexistente" }, token))
    expect(res.status).toBe(400)
  })

  it("returns 400 for malformed JSON", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    const malformed = new Request("http://localhost/api/backoffice/turno", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${BACKOFFICE_COOKIE_NAME}=${token}` },
      body: "{not json",
    })
    const res = await POST(malformed)
    expect(res.status).toBe(400)
  })

  it("D5: returns a JSON 500 error body (no-store) instead of an unhandled throw when the repository fails", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    vi.spyOn(repo, "simularTurno").mockRejectedValue(new Error("boom"))

    const res = await POST(req({ linea: "Línea 3 · Motores" }, token))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(typeof body.error).toBe("string")
  })

  it("simulates a shift on the given línea and returns 200 with a valid cookie/línea", async () => {
    vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
    const token = currentToken()!
    const spy = vi.spyOn(repo, "simularTurno")

    const res = await POST(req({ linea: "Línea 3 · Motores" }, token))

    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith("Línea 3 · Motores")
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  describe("G6: shift-report email", () => {
    it("sends the shift report and reports correo: 'enviado' when the toggle is ON (default)", async () => {
      vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
      const token = currentToken()!
      const sender = new LogEmailSender()
      setEmailSenderForTests(sender)

      const res = await POST(req({ linea: "Línea 3 · Motores" }, token))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ ok: true, correo: "enviado" })
      expect(sender.enviados).toHaveLength(1)
      expect(sender.enviados[0].subject).toContain("Reporte de turno")
    })

    it("skips the email and reports correo: 'omitido' when the toggle is OFF", async () => {
      vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
      const token = currentToken()!
      await repo.setEnviarReporteTurno(false)
      const sender = new LogEmailSender()
      setEmailSenderForTests(sender)

      const res = await POST(req({ linea: "Línea 3 · Motores" }, token))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ ok: true, correo: "omitido" })
      expect(sender.enviados).toHaveLength(0)
    })

    it("still returns 200 with correo: 'error' when sending fails -- an email failure must NOT fail the shift", async () => {
      vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
      const token = currentToken()!
      const fallando: EmailSender = { send: vi.fn().mockRejectedValue(new Error("SMTP down")) }
      setEmailSenderForTests(fallando)

      const res = await POST(req({ linea: "Línea 3 · Motores" }, token))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ ok: true, correo: "error" })
    })

    it("E1: returns 200 with correo: 'error' when report data is unavailable after a committed shift", async () => {
      vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
      const token = currentToken()!
      // Simulates SupabaseFloorRepository's degraded path (post-RPC reads
      // failed): the shift itself already happened -- simularTurno resolves,
      // it never throws -- but the report data it returns is marked
      // unavailable.
      vi.spyOn(repo, "simularTurno").mockImplementation(async (linea) => ({
        linea,
        nuevasAlertas: [],
        indicadores: [],
        alertasAbiertas: 0,
        datosDisponibles: false,
      }))

      const res = await POST(req({ linea: "Línea 3 · Motores" }, token))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toEqual({ ok: true, correo: "error" })
    })

    it("E2: resolves within the bound with correo: 'error' when the email sender hangs", async () => {
      vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
      const token = currentToken()!
      const hanging: EmailSender = { send: () => new Promise(() => {}) }
      setEmailSenderForTests(hanging)

      vi.useFakeTimers()
      try {
        const resPromise = POST(req({ linea: "Línea 3 · Motores" }, token))
        await vi.advanceTimersByTimeAsync(10_000)
        const res = await resPromise
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body).toEqual({ ok: true, correo: "error" })
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe("G7b: push for new ALTA alerts", () => {
    it("pushes every stored subscription once per new ALTA alert this shift generated", async () => {
      vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
      const token = currentToken()!
      const sender = new LogPushSender()
      setPushSenderForTests(sender)
      const store = new InMemoryPushSubscriptionStore()
      await store.guardar({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "p", auth: "a" } })
      setPushSubscriptionStoreForTests(store)

      vi.spyOn(repo, "simularTurno").mockImplementation(async (linea) => ({
        linea,
        nuevasAlertas: [
          { id: "n1", severidad: "parar", titulo: "Fuga", estacion: "E1", timestamp: Date.now(), estado: "nueva" },
          { id: "n2", severidad: "atencion", titulo: "Vibración", estacion: "E4", timestamp: Date.now(), estado: "nueva" },
        ],
        indicadores: [],
        alertasAbiertas: 2,
        datosDisponibles: true,
      }))

      const res = await POST(req({ linea: "Línea 3 · Motores" }, token))
      expect(res.status).toBe(200)
      // Only the ALTA (severidad "parar") alert triggers a push -- 1
      // subscription x 1 ALTA alert.
      expect(sender.enviados).toHaveLength(1)
      expect(sender.enviados[0].payload.title).toContain("Alerta ALTA")
    })

    it("a push failure never fails the shift response", async () => {
      vi.stubEnv("BACKOFFICE_KEY", "dev-facilitador")
      const token = currentToken()!
      setPushSenderForTests({ send: vi.fn().mockRejectedValue(new Error("push service down")) })
      const store = new InMemoryPushSubscriptionStore()
      await store.guardar({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "p", auth: "a" } })
      setPushSubscriptionStoreForTests(store)

      vi.spyOn(repo, "simularTurno").mockImplementation(async (linea) => ({
        linea,
        nuevasAlertas: [{ id: "n1", severidad: "parar", titulo: "Fuga", estacion: "E1", timestamp: Date.now(), estado: "nueva" }],
        indicadores: [],
        alertasAbiertas: 1,
        datosDisponibles: true,
      }))

      const res = await POST(req({ linea: "Línea 3 · Motores" }, token))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })
  })
})
