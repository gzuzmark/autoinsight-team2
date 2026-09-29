import { SEVERIDAD_PALABRA } from "@/lib/status"
import type { AlertasPorSeveridad, EstadoDemo, LineaEstadoDemo } from "@/lib/domain/floor-repository"
import type { Severidad } from "@/lib/mock-data"

// J1 (queued batch J, 2026-09-29): pure row model behind the back-office
// "Estado de la demo" table (components/backoffice/backoffice-dashboard.tsx)
// -- extracted so the component only renders what this module computes, and
// so the D3 "Sin datos" fallback and the per-severity alert breakdown are
// unit-tested without a browser.

/** ALTA/MEDIA/BAJA order, matching the floor's own alert vocabulary (D8,
 * same order `formatearResumenAlertas` uses). */
const ORDEN_SEVERIDAD: Severidad[] = ["parar", "atencion", "ok"]

/** One filled state cell (KPI or overall line state), or null for the D3
 * "Sin datos" fallback -- deliberately not reusing `IndicadorEstadoDemo`
 * (whose `clave` this table already resolved away) or a bare `Severidad`
 * (which cannot represent "no data" without an extra sentinel value). */
export type CeldaEstadoDemo = { estado: Severidad } | null

export type CeldaAlertasDemo = {
  total: number
  porSeveridad: Array<{ severidad: Severidad; palabra: string; cantidad: number }>
} | null

export type FilaEstadoDemo = {
  nombre: string
  estado: CeldaEstadoDemo
  fpy: CeldaEstadoDemo
  defH: CeldaEstadoDemo
  scrap: CeldaEstadoDemo
  alertas: CeldaAlertasDemo
}

function celdaIndicador(linea: LineaEstadoDemo, clave: string): CeldaEstadoDemo {
  const indicador = linea.indicadores.find((i) => i.clave === clave)
  return indicador ? { estado: indicador.estado } : null
}

function celdaAlertas(counts: AlertasPorSeveridad): CeldaAlertasDemo {
  const total = counts.parar + counts.atencion + counts.ok
  const porSeveridad = ORDEN_SEVERIDAD.filter((severidad) => counts[severidad] > 0).map((severidad) => ({
    severidad,
    palabra: SEVERIDAD_PALABRA[severidad],
    cantidad: counts[severidad],
  }))
  return { total, porSeveridad }
}

function filaEstadoDemo(linea: LineaEstadoDemo, datosDisponibles: boolean): FilaEstadoDemo {
  if (!datosDisponibles) {
    return { nombre: linea.nombre, estado: null, fpy: null, defH: null, scrap: null, alertas: null }
  }
  return {
    nombre: linea.nombre,
    estado: { estado: linea.estadoKpi },
    fpy: celdaIndicador(linea, "fpy"),
    defH: celdaIndicador(linea, "dph"),
    scrap: celdaIndicador(linea, "scrap"),
    alertas: celdaAlertas(linea.alertasPorSeveridad),
  }
}

/** One row per known line, in `estadoDemo.lineas`'s own order. */
export function filasEstadoDemo(estadoDemo: EstadoDemo): FilaEstadoDemo[] {
  return estadoDemo.lineas.map((linea) => filaEstadoDemo(linea, estadoDemo.datosDisponibles))
}
