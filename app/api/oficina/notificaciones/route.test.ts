import { beforeEach, describe, expect, it, vi } from "vitest"
import { setFloorRepositoryForTests } from "@/lib/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { GET } from "./route"

/**
 * G9: office notification bell data source. The office has no session/auth
 * (O-D4, same as every other /api/oficina/** route) -- returns only what
 * the office already shows elsewhere (alert id/title/severity/line/station/
 * created_at), never requires a floor session.
 */
describe("GET /api/oficina/notificaciones", () => {
  let repo: InMemoryFloorRepository

  beforeEach(() => {
    repo = new InMemoryFloorRepository()
    setFloorRepositoryForTests(repo)
  })

  it("returns the seeded ALTA alert, no-store", async () => {
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(Array.isArray(body.notificaciones)).toBe(true)
    expect(body.notificaciones.length).toBeGreaterThan(0)
    const primera = body.notificaciones[0]
    expect(primera).toMatchObject({
      severidad: "parar",
      linea: "Línea 3 · Motores",
    })
    expect(typeof primera.id).toBe("string")
    expect(typeof primera.titulo).toBe("string")
    expect(typeof primera.creadaEn).toBe("number")
  })

  it("returns an empty list instead of failing when the repository throws", async () => {
    vi.spyOn(repo, "alertasAltaRecientes").mockRejectedValue(new Error("boom"))
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ notificaciones: [] })
  })
})
