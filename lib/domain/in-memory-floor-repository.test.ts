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

    it("H2: PIN 1234 now also logs in a user that previously had a different PIN", async () => {
      const beto = USUARIOS.find((u) => u.nombre === "Beto Cruz")!
      const sessionId = await repo.iniciarSesion(beto.id, "1234")
      expect(sessionId).toEqual(expect.any(String))
    })

    it("H1: the new Línea 2 demo user (Gabi Paz) can log in with PIN 1234", async () => {
      const gabi = USUARIOS.find((u) => u.nombre === "Gabi Paz")!
      const sessionId = await repo.iniciarSesion(gabi.id, "1234")
      expect(sessionId).toEqual(expect.any(String))
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

    it("H3: reports the active line's seeded alert count and worst KPI state", async () => {
      const estado = await repo.estadoDemo()
      const activa = estado.lineas.find((l) => l.nombre === LINEA_ACTIVA)!
      expect(activa.alertasAbiertas).toBeGreaterThan(0)
      // Worst of Línea 3's seeded KPIs (fpy 88.4 -> parar), NOT the worst
      // open alert's severity -- see LineaEstadoDemo#estadoKpi's doc.
      expect(activa.estadoKpi).toBe("parar")
      expect(activa.ultimaSimulacion).toBeNull()
    })

    it("H3: breaks down the active line's open alerts by severity", async () => {
      const estado = await repo.estadoDemo()
      const activa = estado.lineas.find((l) => l.nombre === LINEA_ACTIVA)!
      // ALERTAS_INICIALES: 2 parar, 3 atencion, 2 ok, all "nueva".
      expect(activa.alertasPorSeveridad).toEqual({ parar: 2, atencion: 3, ok: 2 })
      expect(
        activa.alertasPorSeveridad.parar + activa.alertasPorSeveridad.atencion + activa.alertasPorSeveridad.ok,
      ).toBe(activa.alertasAbiertas)
    })

    it("reports 0 open alerts and 'ok' for a line with no seeded alerts", async () => {
      const estado = await repo.estadoDemo()
      const otra = estado.lineas.find((l) => l.nombre !== LINEA_ACTIVA)!
      expect(otra.alertasAbiertas).toBe(0)
      expect(otra.estadoKpi).toBe("ok")
      expect(otra.alertasPorSeveridad).toEqual({ parar: 0, atencion: 0, ok: 0 })
    })

    it("H3: a line's KPI state is its own (mirrors supabase/seed.sql per-line values, not Línea 3's)", async () => {
      const estado = await repo.estadoDemo()
      const linea2 = estado.lineas.find((l) => l.nombre === "Línea 2 · Pintura")!
      // Línea 2 seed: fpy 90.1 (atencion band), dph 4.5 (atencion), scrap 2.4 (atencion).
      expect(linea2.estadoKpi).toBe("atencion")
    })

    it("G3: escenarioActivo is null until a scenario is applied", async () => {
      const estado = await repo.estadoDemo()
      expect(estado.escenarioActivo).toBeNull()
    })

    it("Batch I: reports datosDisponibles true (a real adapter never fabricates 'unknown')", async () => {
      const estado = await repo.estadoDemo()
      expect(estado.datosDisponibles).toBe(true)
    })

    it("Batch I: each line's indicadores lists fpy/dph/scrap in that stable order with their own state", async () => {
      const estado = await repo.estadoDemo()
      const activa = estado.lineas.find((l) => l.nombre === LINEA_ACTIVA)!
      expect(activa.indicadores.map((i) => i.clave)).toEqual(["fpy", "dph", "scrap"])
      // Línea 3 seed: fpy 88.4 -> parar (matches estadoKpi's worst-of above).
      expect(activa.indicadores.find((i) => i.clave === "fpy")!.estado).toBe("parar")
    })

    it("Batch I: indicadores reflects the line's own baseline, not Línea 3's", async () => {
      const estado = await repo.estadoDemo()
      const linea2 = estado.lineas.find((l) => l.nombre === "Línea 2 · Pintura")!
      // Línea 2 seed: fpy/dph/scrap all in the atencion band.
      expect(linea2.indicadores.map((i) => i.clave)).toEqual(["fpy", "dph", "scrap"])
      for (const i of linea2.indicadores) expect(i.estado).toBe("atencion")
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

    it("G3: clears an active scenario (a shift makes it no longer exact)", async () => {
      await repo.aplicarEscenario("todo-ok")
      await repo.simularTurno(LINEA_ACTIVA)
      const estado = await repo.estadoDemo()
      expect(estado.escenarioActivo).toBeNull()
    })

    it("G6: returns the shift-report data (new alerts, post-shift KPI states, open-alert count)", async () => {
      const reporte = await repo.simularTurno(LINEA_ACTIVA)
      expect(reporte.linea).toBe(LINEA_ACTIVA)
      expect(Array.isArray(reporte.nuevasAlertas)).toBe(true)
      expect(reporte.nuevasAlertas.length).toBeGreaterThan(0)
      expect(reporte.indicadores.length).toBeGreaterThan(0)
      for (const ind of reporte.indicadores) {
        expect(["ok", "atencion", "parar"]).toContain(ind.estado)
      }
      const estado = await repo.estadoDemo()
      const linea = estado.lineas.find((l) => l.nombre === LINEA_ACTIVA)!
      expect(reporte.alertasAbiertas).toBe(linea.alertasAbiertas)
    })
  })

  describe("setEnviarReporteTurno (G6)", () => {
    it("defaults to ON and is reflected in estadoDemo", async () => {
      const estado = await repo.estadoDemo()
      expect(estado.enviarReporteTurno).toBe(true)
    })

    it("can be turned off and back on, independent of demo state", async () => {
      await repo.setEnviarReporteTurno(false)
      expect((await repo.estadoDemo()).enviarReporteTurno).toBe(false)

      // A facilitator preference, not demo state: reset/scenario must not
      // reset it.
      await repo.reiniciarDemo()
      expect((await repo.estadoDemo()).enviarReporteTurno).toBe(false)

      await repo.setEnviarReporteTurno(true)
      expect((await repo.estadoDemo()).enviarReporteTurno).toBe(true)
    })
  })

  describe("aplicarEscenario (G3)", () => {
    it("throws InvalidInputError for an unknown scenario id", async () => {
      // @ts-expect-error deliberately invalid at runtime
      await expect(repo.aplicarEscenario("no-existe")).rejects.toBeInstanceOf(InvalidInputError)
    })

    it("'todo-ok': no open alerts anywhere, every KPI ok, records the active scenario", async () => {
      await repo.aplicarEscenario("todo-ok")
      const estado = await repo.estadoDemo()
      expect(estado.escenarioActivo).toBe("todo-ok")
      for (const linea of estado.lineas) {
        expect(linea.alertasAbiertas).toBe(0)
        expect(linea.estadoKpi).toBe("ok")
      }
    })

    // RDD review E1/E2 + batch H (2026-09-29), F1: since H3 gave Línea 2 its
    // own baseline KPIs (fpy 90.1, dph 4.5, scrap 2.4 -- all in the atencion
    // band, see VALORES_BASE_POR_LINEA / supabase/seed.sql), the assertion
    // above that "every KPI is ok" after 'todo-ok' would pass vacuously if
    // 'todo-ok' happened to leave Línea 2 untouched (its own baseline is
    // never 'ok' on its own). Pin the actual transition explicitly: Línea 2
    // starts 'atencion' before any scenario runs, and 'todo-ok' overrides it
    // to 'ok', not merely defaults it.
    it("'todo-ok': Línea 2's own non-ok baseline is overridden by the scenario, not left alone", async () => {
      const antes = await repo.estadoDemo()
      expect(antes.lineas.find((l) => l.nombre === "Línea 2 · Pintura")!.estadoKpi).toBe("atencion")

      await repo.aplicarEscenario("todo-ok")
      const despues = await repo.estadoDemo()
      expect(despues.lineas.find((l) => l.nombre === "Línea 2 · Pintura")!.estadoKpi).toBe("ok")
    })

    it("'linea3-parar-alta': exactly one open ALTA (parar) alert on Línea 3, other lines ok", async () => {
      await repo.aplicarEscenario("linea3-parar-alta")
      const estado = await repo.estadoDemo()
      expect(estado.escenarioActivo).toBe("linea3-parar-alta")
      const l3 = estado.lineas.find((l) => l.nombre === LINEA_ACTIVA)!
      expect(l3.alertasAbiertas).toBe(1)
      expect(l3.estadoKpi).toBe("parar")
      for (const otra of estado.lineas.filter((l) => l.nombre !== LINEA_ACTIVA)) {
        expect(otra.alertasAbiertas).toBe(0)
        expect(otra.estadoKpi).toBe("ok")
      }
    })

    it("'muchas-media': Línea 3 has more than 3 open MEDIA (atencion) alerts and no ALTA", async () => {
      await repo.aplicarEscenario("muchas-media")
      const estado = await repo.estadoDemo()
      expect(estado.escenarioActivo).toBe("muchas-media")
      const l3 = estado.lineas.find((l) => l.nombre === LINEA_ACTIVA)!
      expect(l3.alertasAbiertas).toBeGreaterThan(3)
      expect(l3.estadoKpi).toBe("atencion")
    })

    it("'recuperacion': Línea 3's alerts are already resolved, KPIs recovered", async () => {
      await repo.aplicarEscenario("recuperacion")
      const estado = await repo.estadoDemo()
      expect(estado.escenarioActivo).toBe("recuperacion")
      const l3 = estado.lineas.find((l) => l.nombre === LINEA_ACTIVA)!
      expect(l3.alertasAbiertas).toBe(0)
      expect(l3.estadoKpi).toBe("ok")
    })

    it("resets to seed before applying (a prior mutation does not leak into the scenario)", async () => {
      await repo.simularTurno(LINEA_ACTIVA)
      await repo.aplicarEscenario("todo-ok")
      const estado = await repo.estadoDemo()
      expect(estado.lineas.find((l) => l.nombre === LINEA_ACTIVA)!.alertasAbiertas).toBe(0)
    })
  })
})
