import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  AlertNotFoundError,
  InvalidInputError,
  SessionInvalidError,
} from "@/lib/domain/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { USUARIOS } from "@/lib/mock-data"

const ANA = USUARIOS[0] // { id: "u1", nombre: "Ana Ríos", pin: "1234", ... }

describe("InMemoryFloorRepository", () => {
  let repo: InMemoryFloorRepository

  beforeEach(() => {
    repo = new InMemoryFloorRepository()
  })

  describe("usuariosLogin", () => {
    it("returns active users without the pin field", async () => {
      const usuarios = await repo.usuariosLogin()
      expect(usuarios.length).toBe(USUARIOS.length)
      for (const u of usuarios) {
        expect(u).not.toHaveProperty("pin")
      }
      expect(usuarios.find((u) => u.id === ANA.id)?.nombre).toBe(ANA.nombre)
    })
  })

  describe("iniciarSesion", () => {
    it("returns a session id on correct PIN", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      expect(sessionId).toEqual(expect.any(String))
    })

    it("returns null on wrong PIN", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, "0000")
      expect(sessionId).toBeNull()
    })

    it("returns null for an unknown user id (no enumeration)", async () => {
      const sessionId = await repo.iniciarSesion("does-not-exist", "1234")
      expect(sessionId).toBeNull()
    })
  })

  describe("cerrarSesion", () => {
    it("is idempotent: closing an unknown session id is a no-op", async () => {
      await expect(repo.cerrarSesion("unknown-session")).resolves.toBeUndefined()
    })

    it("invalidates the session for further calls", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      await repo.cerrarSesion(sessionId!)
      await expect(repo.tablero(sessionId!)).rejects.toBeInstanceOf(SessionInvalidError)
    })
  })

  describe("tablero", () => {
    it("throws SessionInvalidError for an unknown session", async () => {
      await expect(repo.tablero("nope")).rejects.toBeInstanceOf(SessionInvalidError)
    })

    it("returns planta/linea/usuario/indicadores/alertas for a valid session", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const tablero = await repo.tablero(sessionId!)

      expect(tablero.planta.nombre).toEqual(expect.any(String))
      expect(tablero.linea.nombre).toEqual(expect.any(String))
      expect(tablero.linea.turno).toEqual(expect.any(String))
      expect(tablero.usuario.id).toBe(ANA.id)
      expect(tablero.usuario).not.toHaveProperty("pin")
      expect(tablero.indicadores.length).toBeGreaterThan(0)
      expect(tablero.alertas.length).toBeGreaterThan(0)
      expect(tablero.alertas.every((a) => a.estado === "nueva")).toBe(true)
    })

    it("reports first visit (ultimaVisita null, nuevasIds empty) before any logout", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const tablero = await repo.tablero(sessionId!)
      expect(tablero.ultimaVisita).toBeNull()
      expect(tablero.nuevasIds).toEqual([])
    })

    it("reports no new alerts on a second visit when nothing changed", async () => {
      const first = await repo.iniciarSesion(ANA.id, ANA.pin)
      await repo.cerrarSesion(first!)
      const second = await repo.iniciarSesion(ANA.id, ANA.pin)
      const tablero = await repo.tablero(second!)
      expect(tablero.ultimaVisita).toEqual(expect.any(Number))
      expect(tablero.nuevasIds).toEqual([])
    })
  })

  describe("resolverAlerta", () => {
    it("marks an alert atendida and removes it from the active tablero", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const before = await repo.tablero(sessionId!)
      const targetId = before.alertas[0].id

      await repo.resolverAlerta(sessionId!, targetId, "atendida")

      const after = await repo.tablero(sessionId!)
      expect(after.alertas.find((a) => a.id === targetId)).toBeUndefined()
    })

    it("marks an alert no_aplica and removes it from the active tablero", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const before = await repo.tablero(sessionId!)
      const targetId = before.alertas[0].id

      await repo.resolverAlerta(sessionId!, targetId, "no_aplica")

      const after = await repo.tablero(sessionId!)
      expect(after.alertas.find((a) => a.id === targetId)).toBeUndefined()
    })

    it("is idempotent: resolving an already-resolved alert does not throw", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const before = await repo.tablero(sessionId!)
      const targetId = before.alertas[0].id

      await repo.resolverAlerta(sessionId!, targetId, "atendida")
      await expect(repo.resolverAlerta(sessionId!, targetId, "atendida")).resolves.toBeUndefined()
    })

    it("throws AlertNotFoundError for an unknown alert id", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      await expect(repo.resolverAlerta(sessionId!, "no-such-alert", "atendida")).rejects.toBeInstanceOf(
        AlertNotFoundError,
      )
    })

    it("throws InvalidInputError for an invalid resolution value", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const before = await repo.tablero(sessionId!)
      const targetId = before.alertas[0].id
      // @ts-expect-error deliberately invalid at runtime
      await expect(repo.resolverAlerta(sessionId!, targetId, "bogus")).rejects.toBeInstanceOf(InvalidInputError)
    })

    it("throws SessionInvalidError for an unknown session", async () => {
      await expect(repo.resolverAlerta("nope", "a1", "atendida")).rejects.toBeInstanceOf(SessionInvalidError)
    })

    it("D24: never changes any KPI tile (atendida)", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const before = await repo.tablero(sessionId!)
      const targetId = before.alertas[0].id

      await repo.resolverAlerta(sessionId!, targetId, "atendida")

      const after = await repo.tablero(sessionId!)
      expect(after.indicadores).toEqual(before.indicadores)
    })

    it("D24: never changes any KPI tile (no_aplica)", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const before = await repo.tablero(sessionId!)
      const targetId = before.alertas[0].id

      await repo.resolverAlerta(sessionId!, targetId, "no_aplica")

      const after = await repo.tablero(sessionId!)
      expect(after.indicadores).toEqual(before.indicadores)
    })
  })

  describe("simular", () => {
    it("adds new active alerts and marks them as nuevasIds", async () => {
      // A non-null ultimaVisita is required for anything to count as "new"
      // (first visit always reports nuevasIds: []), so log in/out once
      // first, then advance the clock so the simulated alerts are
      // unambiguously newer than that visit timestamp.
      vi.useFakeTimers()
      try {
        const warmup = await repo.iniciarSesion(ANA.id, ANA.pin)
        await repo.cerrarSesion(warmup!)
        vi.advanceTimersByTime(1000)
        const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
        const before = await repo.tablero(sessionId!)

        const after = await repo.simular(sessionId!)

        expect(after.alertas.length).toBeGreaterThan(before.alertas.length)
        expect(after.nuevasIds.length).toBeGreaterThan(0)
      } finally {
        vi.useRealTimers()
      }
    })

    it("is idempotent: simulating twice does not duplicate ids", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const once = await repo.simular(sessionId!)
      const twice = await repo.simular(sessionId!)
      expect(twice.alertas.length).toBe(once.alertas.length)
    })

    it("throws SessionInvalidError for an unknown session", async () => {
      await expect(repo.simular("nope")).rejects.toBeInstanceOf(SessionInvalidError)
    })

    it("D26: moves every KPI one state toward ok (recovery reading)", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const before = await repo.tablero(sessionId!)
      const fpyBefore = before.indicadores.find((i) => i.id === "fpy")
      const dphBefore = before.indicadores.find((i) => i.id === "dph")
      expect(fpyBefore?.estado).toBe("parar")
      expect(dphBefore?.estado).toBe("atencion")

      const after = await repo.simular(sessionId!)

      expect(after.indicadores.find((i) => i.id === "fpy")?.estado).toBe("atencion")
      expect(after.indicadores.find((i) => i.id === "dph")?.estado).toBe("ok")
      // Scrap was already ok; recovery keeps it ok.
      expect(after.indicadores.find((i) => i.id === "scrap")?.estado).toBe("ok")
    })
  })
})
