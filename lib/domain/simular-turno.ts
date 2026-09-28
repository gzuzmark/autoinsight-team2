import { randomUUID } from "node:crypto"
import type { Alerta, Indicador, Severidad } from "@/lib/mock-data"
import { sortAlerts } from "@/lib/domain/alerts"
import { recuperarIndicador } from "@/lib/domain/indicadores"

export type PlantillaTurno = {
  severidad: Severidad
  titulo: string
  estacion: string
  /** Links to an `Indicador.id` (fpy/dph/scrap), mirroring
   * `plantillas_alerta.indicador_clave` (D25). Undefined = unlinked. */
  indicadorId?: string
}

/**
 * Mock-mode analogue of `supabase/seed.sql`'s `plantillas_alerta` catalog
 * (a small fixed subset, deterministic order -- enough templates to
 * demonstrate free-room eviction (K5) without a random-pick dependency).
 */
export const PLANTILLAS_TURNO: PlantillaTurno[] = [
  { severidad: "parar", titulo: "Paro de línea por fuga de aire", estacion: "Estación 6 · Neumática", indicadorId: "fpy" },
  { severidad: "atencion", titulo: "Nivel de adhesivo bajo", estacion: "Estación 5 · Curado", indicadorId: "scrap" },
  { severidad: "parar", titulo: "Torque fuera de rango", estacion: "Estación 7 · Atornillado", indicadorId: "dph" },
  { severidad: "atencion", titulo: "Vibración anómala en banda", estacion: "Estación 4 · Ensamble", indicadorId: "dph" },
  { severidad: "ok", titulo: "Nivel de refrigerante en rango", estacion: "Estación 1 · Recepción" },
]

export type SimularTurnoResult = {
  alertas: Alerta[]
  indicadoresState: Indicador[]
  agregadas: Alerta[]
}

/**
 * Mock-mode analogue of `private.simular_turno_en_linea`
 * (`supabase/migrations/20260926000018_demo_simular_turno_linea.sql`), used
 * by `InMemoryFloorRepository` so mock mode's "Simular turno" follows the
 * same rules the Supabase adapter enforces in SQL, deterministically (no
 * `random()`, so demos/tests are reproducible):
 *
 *   1. K5 "free room": if fewer templates are free (not already active on
 *      the line) than `cantidad`, the oldest template-generated active
 *      alerts are marked "no_aplica" (system resolution, `resuelta_por`
 *      stays unset by the caller) to make room.
 *   2. Generates up to `cantidad` new "nueva" alerts from the now-free
 *      templates, in catalog order.
 *   3. D25: a KPI-linked template records a new reading on its indicator
 *      (landing solidly in the template's own severity band).
 *   4. D26: every OTHER indicator (not just hit) recovers one step toward
 *      ok via `recuperarIndicador`.
 *
 * Pure: does not mutate its inputs.
 */
export function simularTurnoLinea(
  alertas: readonly Alerta[],
  indicadoresState: readonly Indicador[],
  cantidad: number,
  ahora: number,
): SimularTurnoResult {
  const objetivo = Math.max(cantidad, 0)
  let siguientes = [...alertas]

  const tituloEsPlantilla = (titulo: string) => PLANTILLAS_TURNO.some((t) => t.titulo === titulo)
  const disponibles = () =>
    PLANTILLAS_TURNO.filter((t) => !siguientes.some((a) => a.titulo === t.titulo && a.estado === "nueva"))

  if (disponibles().length < objetivo) {
    const activasPlantilla = siguientes
      .filter((a) => a.estado === "nueva" && tituloEsPlantilla(a.titulo))
      .sort((a, b) => a.timestamp - b.timestamp)
    const necesarias = objetivo - disponibles().length
    const aLiberar = new Set(activasPlantilla.slice(0, necesarias).map((a) => a.id))
    siguientes = siguientes.map((a) =>
      aLiberar.has(a.id) ? { ...a, estado: "no_aplica" as const } : a,
    )
  }

  const agregadas: Alerta[] = []
  // C2 fix: track each touched indicator's OWN template severidad (was a
  // plain Set, which lost this and always applied the parar-band formula --
  // contradicting the D25 docstring above for an "atencion" template).
  const clavesTocadas = new Map<string, Severidad>()
  for (let i = 0; i < objetivo; i++) {
    const candidatas = disponibles()
    if (candidatas.length === 0) break
    const plantilla = candidatas[0]
    const nueva: Alerta = {
      id: randomUUID(),
      severidad: plantilla.severidad,
      titulo: plantilla.titulo,
      estacion: plantilla.estacion,
      timestamp: ahora,
      estado: "nueva",
    }
    siguientes = [...siguientes, nueva]
    agregadas.push(nueva)
    if (plantilla.indicadorId) clavesTocadas.set(plantilla.indicadorId, plantilla.severidad)
  }

  const indicadoresTocados = indicadoresState.map((ind) => {
    const severidad = clavesTocadas.get(ind.id)
    return severidad ? { ...ind, valor: valorEnBanda(ind, severidad), actualizadoEn: ahora } : ind
  })
  const siguienteIndicadores = indicadoresTocados.map((ind) =>
    clavesTocadas.has(ind.id) ? ind : recuperarIndicador(ind, ahora),
  )

  return {
    alertas: sortAlerts(siguientes),
    indicadoresState: siguienteIndicadores,
    agregadas: sortAlerts(agregadas),
  }
}

/**
 * Deterministic "fresh shift" reading, landing inside the template's OWN
 * severity band (C2 fix, D25: a KPI-linked template's reading must fall in
 * ITS OWN band -- an "atencion" template must not write a "parar" reading).
 *   - "parar": just past the parar threshold (same as before this fix).
 *   - "atencion": the midpoint between the atencion and parar thresholds
 *     (mirrors `recuperarIndicador`'s parar->atencion step).
 *   - "ok": not expected in practice (PLANTILLAS_TURNO's only "ok" template
 *     is unlinked), but handled safely: a small, direction-safe nudge that
 *     stays ok, same formula as `recuperarIndicador`'s ok case.
 */
function valorEnBanda(ind: Indicador, severidad: Severidad): number {
  const { mayorEsMejor, umbralAtencion, umbralParar, valor } = ind
  if (severidad === "parar") {
    const paso = Math.max(Math.abs(umbralParar) * 0.02, 0.2)
    return mayorEsMejor ? Math.max(umbralParar - paso, 0) : umbralParar + paso
  }
  if (severidad === "atencion") {
    return (umbralParar + umbralAtencion) / 2
  }
  const paso = Math.max(Math.abs(valor) * 0.01, 0.05)
  return mayorEsMejor ? valor + paso : Math.max(valor - paso, 0)
}
