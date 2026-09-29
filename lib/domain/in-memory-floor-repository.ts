import { randomUUID } from "node:crypto"
import { activeAlerts, attendAlert, dismissAlert } from "@/lib/domain/alerts"
import { indicadorATablero } from "@/lib/domain/indicadores"
import { simularTurnoLinea } from "@/lib/domain/simular-turno"
import type { EscenarioId } from "@/lib/domain/escenarios"
import { esEscenarioId } from "@/lib/domain/escenarios"
import type {
  EstadoDemo,
  FloorRepository,
  IndicadorTablero,
  LineaDemoConocida,
  ReporteTurnoDatos,
  Resolucion,
  Tablero,
  UsuarioLogin,
} from "@/lib/domain/floor-repository"
import {
  AlertNotFoundError,
  esLineaDemoConocida,
  InvalidInputError,
  LINEAS_DEMO_CONOCIDAS,
  SessionInvalidError,
} from "@/lib/domain/floor-repository"
import {
  ALERTAS_INICIALES,
  INDICADORES,
  ordenarAlertas,
  PLANTA_NOMBRE,
  USUARIOS,
  type Alerta,
  type Indicador,
} from "@/lib/mock-data"

const LINEA = { nombre: "Línea 3 · Motores" as LineaDemoConocida, turno: "Turno mañana" }

/** Per-line demo state (G2): every `LineaDemoConocida` gets one entry so the
 * back office can act on any of them even though only `LINEA` (Línea 3) is
 * ever attached to a floor session in mock mode (mock users are not tied to
 * a line -- see the D19 note in floor-repository.ts). The other two lines
 * start empty (no seeded alerts, same baseline KPIs), matching
 * supabase/seed.sql, which also only seeds starting alerts for Línea 3. */
type LineaEstado = {
  alertas: Alerta[]
  indicadoresState: Indicador[]
  ultimaSimulacion: number | null
}

function estadoInicialLinea(nombre: LineaDemoConocida): LineaEstado {
  return {
    alertas: nombre === LINEA.nombre ? ordenarAlertas(ALERTAS_INICIALES.map((a) => ({ ...a }))) : [],
    indicadoresState: INDICADORES.map((i) => ({ ...i })),
    ultimaSimulacion: null,
  }
}

function estadoInicialLineas(): Map<LineaDemoConocida, LineaEstado> {
  return new Map(LINEAS_DEMO_CONOCIDAS.map((nombre) => [nombre, estadoInicialLinea(nombre)]))
}

// G3: deterministic KPI-band constructors for scenario building, mirroring
// the SQL migration's explicit values (supabase/migrations/20260928000022_demo_escenarios.sql)
// -- each lands solidly inside its target band, same direction convention
// as lib/domain/simular-turno.ts and lib/domain/indicadores.ts#recuperarIndicador.
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

function indicadorEnOk(ind: Indicador, ahora: number): Indicador {
  const paso = Math.max(Math.abs(ind.umbralAtencion) * 0.03, 0.5)
  const valor = ind.mayorEsMejor ? ind.umbralAtencion + paso : Math.max(ind.umbralAtencion - paso, 0)
  return { ...ind, valor: redondear(valor), actualizadoEn: ahora }
}

function indicadorEnAtencion(ind: Indicador, ahora: number): Indicador {
  return { ...ind, valor: redondear((ind.umbralAtencion + ind.umbralParar) / 2), actualizadoEn: ahora }
}

function indicadorEnParar(ind: Indicador, ahora: number): Indicador {
  const paso = Math.max(Math.abs(ind.umbralParar) * 0.02, 0.2)
  const valor = ind.mayorEsMejor ? Math.max(ind.umbralParar - paso, 0) : ind.umbralParar + paso
  return { ...ind, valor: redondear(valor), actualizadoEn: ahora }
}

// G3: fixed alert sets per scenario, on Línea 3 only (the other two known
// lines get zero alerts + every KPI in ok, "other lines OK" per the brief).
function alertaAltaLinea3(ahora: number): Alerta {
  return {
    id: randomUUID(),
    severidad: "parar",
    titulo: "FPY por debajo del 90 %",
    estacion: "Estación 4 · Ensamble",
    timestamp: ahora,
    estado: "nueva",
  }
}

function alertasMediaLinea3(ahora: number): Alerta[] {
  const plantillas = [
    { titulo: "Defectos por hora en aumento", estacion: "Estación 2 · Soldadura" },
    { titulo: "Retrabajo sobre lo esperado", estacion: "Estación 3 · Inspección" },
    { titulo: "Temperatura de horno alta", estacion: "Estación 5 · Curado" },
    { titulo: "Vibración anómala en banda", estacion: "Estación 4 · Ensamble" },
    { titulo: "Nivel de adhesivo bajo", estacion: "Estación 6 · Neumática" },
  ]
  return plantillas.map((p, i) => ({
    id: randomUUID(),
    severidad: "atencion" as const,
    titulo: p.titulo,
    estacion: p.estacion,
    timestamp: ahora - i * 60_000,
    estado: "nueva" as const,
  }))
}

function alertasResueltasLinea3(ahora: number): Alerta[] {
  return [
    {
      id: randomUUID(),
      severidad: "parar",
      titulo: "FPY por debajo del 90 %",
      estacion: "Estación 4 · Ensamble",
      timestamp: ahora - 40 * 60_000,
      estado: "atendida",
    },
    {
      id: randomUUID(),
      severidad: "parar",
      titulo: "Torque fuera de rango",
      estacion: "Estación 7 · Atornillado",
      timestamp: ahora - 35 * 60_000,
      estado: "no_aplica",
    },
  ]
}

type Sesion = {
  usuarioId: string
  /** Snapshot of the user's last-visit timestamp, fixed for the lifetime of
   * this session (mirrors the previous `ultimoLogoutTs` ref: it must not
   * change while the session that will become "the last visit" is itself
   * still open). */
  ultimaVisita: number | null
}

/**
 * Mock-mode adapter (D19): reproduces the app's pre-Phase-C behavior exactly
 * -- same users/PINs, same seed alerts, same shift-simulation alerts, same
 * since-last-visit derivation -- without a real backend, so existing tests,
 * `test:ui` and demos keep working with no server configured.
 *
 * State is process-memory only (module-level singleton via
 * `getFloorRepository()`); it does not survive a server restart and is not
 * shared across serverless instances, same limitation as the login-attempt
 * throttle documented in the README.
 */
export class InMemoryFloorRepository implements FloorRepository {
  /** G2: one entry per LINEAS_DEMO_CONOCIDAS. `LINEA` (Línea 3) is the only
   * one a floor session ever reads from `tablero()`; the others exist so
   * the back office's "Estado de la demo" and "Simular turno" have
   * somewhere to write. */
  private lineasEstado: Map<LineaDemoConocida, LineaEstado> = estadoInicialLineas()
  /** G3: id of the last scenario applied via aplicarEscenario, or null.
   * Cleared by reiniciarDemo() and simularTurno() -- see EstadoDemo's doc. */
  private escenarioActivo: EscenarioId | null = null
  /** G6: "Enviar reporte al simular turno" toggle, default ON. NOT reset by
   * reiniciarDemo()/aplicarEscenario() -- it is a facilitator preference,
   * not demo state (mirrors the Supabase adapter's singleton column). */
  private enviarReporteTurno = true
  private ultimaActualizacion = Date.now()
  private readonly sesiones = new Map<string, Sesion>()
  /** Epoch ms of each user's most recent closed session (their "last
   * visit"), keyed by user id. Absent = never logged out before. */
  private readonly ultimaVisitaPorUsuario = new Map<string, number>()

  async usuariosLogin(): Promise<UsuarioLogin[]> {
    return USUARIOS.map(({ id, nombre, iniciales, color }) => ({ id, nombre, iniciales, color }))
  }

  async iniciarSesion(usuarioId: string, pin: string): Promise<string | null> {
    const usuario = USUARIOS.find((u) => u.id === usuarioId)
    if (!usuario || usuario.pin !== pin) return null

    const sessionId = randomUUID()
    this.sesiones.set(sessionId, {
      usuarioId,
      ultimaVisita: this.ultimaVisitaPorUsuario.get(usuarioId) ?? null,
    })
    return sessionId
  }

  async cerrarSesion(sessionId: string): Promise<void> {
    const sesion = this.sesiones.get(sessionId)
    if (!sesion) return
    this.ultimaVisitaPorUsuario.set(sesion.usuarioId, Date.now())
    this.sesiones.delete(sessionId)
  }

  async tablero(sessionId: string): Promise<Tablero> {
    const sesion = this.requireSesion(sessionId)
    const usuario = USUARIOS.find((u) => u.id === sesion.usuarioId)!
    const lineaActiva = this.lineaActiva()
    const activas = activeAlerts(lineaActiva.alertas)

    return {
      planta: { nombre: PLANTA_NOMBRE },
      linea: LINEA,
      usuario: { id: usuario.id, nombre: usuario.nombre, iniciales: usuario.iniciales, color: usuario.color },
      indicadores: this.indicadores(),
      alertas: activas,
      ultimaActualizacion: this.ultimaActualizacion,
      ultimaVisita: sesion.ultimaVisita,
      nuevasIds: this.nuevasIdsDesde(activas, sesion.ultimaVisita),
      cambiosDesdeVisita: this.cambiosDesdeVisita(sesion.ultimaVisita),
    }
  }

  async resolverAlerta(sessionId: string, alertaId: string, resolucion: Resolucion): Promise<void> {
    this.requireSesion(sessionId)

    if (resolucion !== "atendida" && resolucion !== "no_aplica") {
      throw new InvalidInputError("Resolución inválida.")
    }
    const lineaActiva = this.lineaActiva()
    if (!lineaActiva.alertas.some((a) => a.id === alertaId)) {
      throw new AlertNotFoundError("Alerta no encontrada.")
    }

    lineaActiva.alertas =
      resolucion === "atendida"
        ? attendAlert(lineaActiva.alertas, alertaId)
        : dismissAlert(lineaActiva.alertas, alertaId)
    this.ultimaActualizacion = Date.now()
  }

  async estadoDemo(): Promise<EstadoDemo> {
    return {
      lineas: LINEAS_DEMO_CONOCIDAS.map((nombre) => {
        const estado = this.lineasEstado.get(nombre)!
        const activas = activeAlerts(estado.alertas)
        return {
          nombre,
          estado: activas[0]?.severidad ?? "ok",
          alertasAbiertas: activas.length,
          ultimaSimulacion: estado.ultimaSimulacion,
        }
      }),
      escenarioActivo: this.escenarioActivo,
      enviarReporteTurno: this.enviarReporteTurno,
    }
  }

  async setEnviarReporteTurno(valor: boolean): Promise<void> {
    this.enviarReporteTurno = valor
  }

  async reiniciarDemo(): Promise<void> {
    this.lineasEstado = estadoInicialLineas()
    this.sesiones.clear()
    this.ultimaVisitaPorUsuario.clear()
    this.ultimaActualizacion = Date.now()
    // G3: a plain reset means "Estado inicial" -- no scenario is active.
    this.escenarioActivo = null
    // Mock mode has no per-user PIN lockout to reset -- lib/api/login-throttle.ts
    // is a per-IP request rate limit (route-level, not demo/PIN state) and is
    // deliberately left alone here, same as the Supabase adapter leaves
    // sesiones/usuarios/usuarios_pin alone.
  }

  async simularTurno(linea: LineaDemoConocida): Promise<ReporteTurnoDatos> {
    if (!esLineaDemoConocida(linea) || !this.lineasEstado.has(linea)) {
      throw new InvalidInputError(`Línea desconocida: ${linea}`)
    }
    const estado = this.lineasEstado.get(linea)!
    const ahora = Date.now()
    const resultado = simularTurnoLinea(estado.alertas, estado.indicadoresState, 2, ahora)
    this.lineasEstado.set(linea, {
      alertas: resultado.alertas,
      indicadoresState: resultado.indicadoresState,
      ultimaSimulacion: ahora,
    })
    if (linea === LINEA.nombre) this.ultimaActualizacion = ahora
    // G3: a shift makes a previously-applied scenario no longer exact.
    this.escenarioActivo = null

    // G6: report data for the caller -- built from the same post-shift
    // state just written above, never a separate re-derivation.
    return {
      linea,
      nuevasAlertas: resultado.agregadas,
      indicadores: resultado.indicadoresState.map(indicadorATablero),
      alertasAbiertas: activeAlerts(resultado.alertas).length,
    }
  }

  async aplicarEscenario(id: EscenarioId): Promise<void> {
    if (!esEscenarioId(id)) {
      throw new InvalidInputError(`Escenario desconocido: ${id}`)
    }
    await this.reiniciarDemo()
    const ahora = Date.now()

    const nuevoEstado = new Map<LineaDemoConocida, LineaEstado>()
    for (const nombre of LINEAS_DEMO_CONOCIDAS) {
      const base = estadoInicialLinea(nombre)
      const indicadoresOk = base.indicadoresState.map((i) => indicadorEnOk(i, ahora))
      const esLinea3 = nombre === LINEA.nombre

      if (id === "todo-ok" || !esLinea3) {
        nuevoEstado.set(nombre, { alertas: [], indicadoresState: indicadoresOk, ultimaSimulacion: null })
        continue
      }

      if (id === "linea3-parar-alta") {
        nuevoEstado.set(nombre, {
          alertas: [alertaAltaLinea3(ahora)],
          indicadoresState: indicadoresOk.map((i) => (i.id === "fpy" ? indicadorEnParar(i, ahora) : i)),
          ultimaSimulacion: null,
        })
      } else if (id === "muchas-media") {
        nuevoEstado.set(nombre, {
          alertas: alertasMediaLinea3(ahora),
          indicadoresState: indicadoresOk.map((i) => (i.id === "dph" ? indicadorEnAtencion(i, ahora) : i)),
          ultimaSimulacion: null,
        })
      } else {
        // "recuperacion": alerts already resolved, every KPI recovered to ok.
        nuevoEstado.set(nombre, {
          alertas: alertasResueltasLinea3(ahora),
          indicadoresState: indicadoresOk,
          ultimaSimulacion: null,
        })
      }
    }

    this.lineasEstado = nuevoEstado
    this.escenarioActivo = id
    this.ultimaActualizacion = ahora
  }

  private lineaActiva(): LineaEstado {
    return this.lineasEstado.get(LINEA.nombre)!
  }

  private requireSesion(sessionId: string): Sesion {
    const sesion = this.sesiones.get(sessionId)
    if (!sesion) throw new SessionInvalidError("Sesión inválida.")
    return sesion
  }

  private indicadores(): IndicadorTablero[] {
    return this.lineaActiva().indicadoresState.map(indicadorATablero)
  }

  /** Currently-active alerts created after `ultimaVisita` (mirrors the
   * Supabase RPC's `nuevas_ids`: time-based, active-only). `ultimaVisita`
   * null means first visit: nothing to compare against. */
  private nuevasIdsDesde(activas: Alerta[], ultimaVisita: number | null): string[] {
    if (ultimaVisita === null) return []
    return activas.filter((a) => a.timestamp > ultimaVisita).map((a) => a.id)
  }

  /** K2: count of ALL alerts (any estado) created after `ultimaVisita`,
   * unlike `nuevasIdsDesde` which is active-only. 0 on first visit. */
  private cambiosDesdeVisita(ultimaVisita: number | null): number {
    if (ultimaVisita === null) return 0
    return this.lineaActiva().alertas.filter((a) => a.timestamp > ultimaVisita).length
  }
}
