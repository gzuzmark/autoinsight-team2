import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  AlertNotFoundError,
  InvalidInputError,
  LINEAS_DEMO_CONOCIDAS,
  SessionInvalidError,
} from "@/lib/domain/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { USUARIOS } from "@/lib/mock-data"

const LINEA_ACTIVA = "Línea 3 · Motores"

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

  describe("estadoDemo (G2)", () => {
    it("returns one row per known line, matching LINEAS_DEMO_CONOCIDAS", async () => {
      const estado = await repo.estadoDemo()
      expect(estado.lineas.map((l) => l.nombre).sort()).toEqual([...LINEAS_DEMO_CONOCIDAS].sort())
    })

    it("reports the active line's seeded alert count and worst severity", async () => {
      const estado = await repo.estadoDemo()
      const activa = estado.lineas.find((l) => l.nombre === LINEA_ACTIVA)!
      expect(activa.alertasAbiertas).toBeGreaterThan(0)
      expect(activa.estado).toBe("parar") // ALERTAS_INICIALES includes two "parar" alerts
      expect(activa.ultimaSimulacion).toBeNull()
    })

    it("reports 0 open alerts and 'ok' for a line with no seeded alerts", async () => {
      const estado = await repo.estadoDemo()
      const otra = estado.lineas.find((l) => l.nombre !== LINEA_ACTIVA)!
      expect(otra.alertasAbiertas).toBe(0)
      expect(otra.estado).toBe("ok")
    })
  })

  describe("reiniciarDemo (G2)", () => {
    it("restores the active line's alerts and indicators to their seeded state", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const seeded = await repo.tablero(sessionId!)
      await repo.resolverAlerta(sessionId!, seeded.alertas[0].id, "atendida")
      await repo.simularTurno(LINEA_ACTIVA)

      await repo.reiniciarDemo()

      const sessionId2 = await repo.iniciarSesion(ANA.id, ANA.pin)
      const after = await repo.tablero(sessionId2!)
      expect(after.alertas.map((a) => a.id).sort()).toEqual(seeded.alertas.map((a) => a.id).sort())
      expect(after.indicadores).toEqual(seeded.indicadores)
    })

    it("clears 'since last visit' state (first visit again after reset)", async () => {
      const first = await repo.iniciarSesion(ANA.id, ANA.pin)
      await repo.cerrarSesion(first!)

      await repo.reiniciarDemo()

      const second = await repo.iniciarSesion(ANA.id, ANA.pin)
      const tablero = await repo.tablero(second!)
      expect(tablero.ultimaVisita).toBeNull()
    })

    it("does not touch users/PINs (login still works with the same PIN after reset)", async () => {
      await repo.reiniciarDemo()
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      expect(sessionId).toEqual(expect.any(String))
    })

    it("invalidates open sessions (a facilitator reset starts the next participant fresh)", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      await repo.reiniciarDemo()
      await expect(repo.tablero(sessionId!)).rejects.toBeInstanceOf(SessionInvalidError)
    })

    it("resets every line's last-shift bookkeeping to null", async () => {
      await repo.simularTurno(LINEA_ACTIVA)
      await repo.reiniciarDemo()
      const estado = await repo.estadoDemo()
      expect(estado.lineas.every((l) => l.ultimaSimulacion === null)).toBe(true)
    })
  })

  describe("simularTurno (G2)", () => {
    it("adds new active alerts on the target line, reflected in estadoDemo", async () => {
      const before = await repo.estadoDemo()
      const antes = before.lineas.find((l) => l.nombre === LINEA_ACTIVA)!.alertasAbiertas

      await repo.simularTurno(LINEA_ACTIVA)

      const after = await repo.estadoDemo()
      const despues = after.lineas.find((l) => l.nombre === LINEA_ACTIVA)!
      expect(despues.alertasAbiertas).toBeGreaterThan(antes)
      expect(despues.ultimaSimulacion).toEqual(expect.any(Number))
    })

    it("only affects the target line, not the others", async () => {
      await repo.simularTurno(LINEA_ACTIVA)
      const estado = await repo.estadoDemo()
      const otras = estado.lineas.filter((l) => l.nombre !== LINEA_ACTIVA)
      expect(otras.every((l) => l.ultimaSimulacion === null)).toBe(true)
    })

    it("throws InvalidInputError for an unknown line", async () => {
      // @ts-expect-error deliberately invalid at runtime
      await expect(repo.simularTurno("Línea inexistente")).rejects.toBeInstanceOf(InvalidInputError)
    })

    it("is reflected in a floor session's tablero on the active line (mock sessions are all on Línea 3)", async () => {
      const sessionId = await repo.iniciarSesion(ANA.id, ANA.pin)
      const before = await repo.tablero(sessionId!)

      await repo.simularTurno(LINEA_ACTIVA)

      const after = await repo.tablero(sessionId!)
      expect(after.alertas.length).toBeGreaterThan(before.alertas.length)
    })
  })
})
