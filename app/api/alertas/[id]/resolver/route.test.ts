import { describe, expect, it } from "vitest"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { SESSION_COOKIE_NAME } from "@/lib/api/session-cookie"
import { USUARIOS } from "@/lib/mock-data"
import { POST } from "./route"

async function loginAndGetFirstAlertId(): Promise<{ sessionId: string; alertaId: string }> {
  const repo = new InMemoryFloorRepository()
  setFloorRepositoryForTests(repo)
  const sessionId = (await repo.iniciarSesion(USUARIOS[0].id, USUARIOS[0].pin))!
  const tablero = await repo.tablero(sessionId)
  return { sessionId, alertaId: tablero.alertas[0].id }
}

function req(body: unknown, sessionId?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (sessionId) headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`
  return new Request("http://localhost/api/alertas/x/resolver", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe("POST /api/alertas/[id]/resolver", () => {
  it("resolves an alert and returns 200 with the updated tablero", async () => {
    const { sessionId, alertaId } = await loginAndGetFirstAlertId()

    const res = await POST(req({ resolucion: "atendida" }, sessionId), ctx(alertaId))

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    const body = await res.json()
    expect(body.alertas.find((a: { id: string }) => a.id === alertaId)).toBeUndefined()
  })

  it("accepts no_aplica as a resolution", async () => {
    const { sessionId, alertaId } = await loginAndGetFirstAlertId()
    const res = await POST(req({ resolucion: "no_aplica" }, sessionId), ctx(alertaId))
    expect(res.status).toBe(200)
  })

  it("returns 400 for an invalid resolution value", async () => {
    const { sessionId, alertaId } = await loginAndGetFirstAlertId()

    const res = await POST(req({ resolucion: "bogus" }, sessionId), ctx(alertaId))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Resolución inválida." })
  })

  it("returns 400 for malformed JSON", async () => {
    const { sessionId, alertaId } = await loginAndGetFirstAlertId()
    const badReq = new Request("http://localhost/api/alertas/x/resolver", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
      },
      body: "{oops",
    })

    const res = await POST(badReq, ctx(alertaId))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Resolución inválida." })
  })

  it("returns 401 with no session", async () => {
    setFloorRepositoryForTests(new InMemoryFloorRepository())
    const res = await POST(req({ resolucion: "atendida" }), ctx("whatever"))
    expect(res.status).toBe(401)
  })

  it("returns 404 for an unknown alert id", async () => {
    const { sessionId } = await loginAndGetFirstAlertId()

    const res = await POST(req({ resolucion: "atendida" }, sessionId), ctx("no-such-alert"))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Alerta no encontrada." })
  })
})
