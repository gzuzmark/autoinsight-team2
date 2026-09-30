// G10: maps a real FloorRepository#resumenOficina result onto the office
// Resumen screen's own display shapes (KPI cards + "Últimas alertas" table
// rows) -- pure/unit-tested so formatting stays verifiable without a
// repository, same pattern as lib/oficina/alerta-real.ts (G7b).
import type { AlertaResumenOficina, IndicadorPlantaResumen, ResumenOficina } from "@/lib/domain/floor-repository"
import type { EstadoAlerta as EstadoAlertaFloor } from "@/lib/mock-data"
import { haceCuanto } from "@/lib/mock-data"
import type { AlertaOficina, EstadoAlerta as EstadoAlertaOficina, Severidad as SeveridadOficina } from "@/lib/oficina/mock-data"

export type KpiVista = {
  id: string
  nombre: string
  valor: string
  /** e.g. "7 de gravedad ALTA" / "objetivo 30 min" -- undefined when there
   * is nothing useful to add (no fabricated "vs. período anterior": G10
   * removed the sample deltas since there is no historical comparison data
   * yet). */
  nota?: string
  /** Per-line breakdown for the fpy/dph/scrap cards (title attribute /
   * tooltip); undefined for the alertas/atención cards, which are already
   * plant-wide counts. */
  tooltip?: string
}

const ESTADO_MAP: Record<EstadoAlertaFloor, EstadoAlertaOficina> = {
  nueva: "Nueva",
  atendida: "Atendida",
  no_aplica: "No aplica",
}

function formatearNumero(valor: number): string {
  return valor.toFixed(1).replace(".", ",")
}

function formatearValorIndicador(indicador: IndicadorPlantaResumen): string {
  const texto = formatearNumero(indicador.promedio)
  return indicador.unidad === "%" ? `${texto} %` : texto
}

function tooltipPorLinea(indicador: IndicadorPlantaResumen): string {
  const unidadSufijo = indicador.unidad === "%" ? " %" : ` ${indicador.unidad}`
  return indicador.porLinea.map((l) => `${l.linea}: ${formatearNumero(l.valor)}${unidadSufijo}`).join(" · ")
}

/** Builds the 5 office Resumen KPI cards (fpy/dph/scrap plant averages,
 * open-alert count, mean attention time) from real data -- same 5 slots the
 * static mock KPIS array used, now honest about having no delta/comparison
 * data (G10: "remove them or show '—'", never fabricated). */
export function resumenOficinaAKpis(resumen: ResumenOficina): KpiVista[] {
  const indicadorKpis: KpiVista[] = resumen.indicadores.map((indicador) => ({
    id: indicador.clave,
    nombre: indicador.nombre,
    valor: formatearValorIndicador(indicador),
    tooltip: indicador.porLinea.length > 0 ? tooltipPorLinea(indicador) : undefined,
  }))

  return [
    ...indicadorKpis,
    {
      id: "alertas",
      nombre: "Alertas abiertas",
      valor: String(resumen.alertasAbiertas),
      nota: `${resumen.alertasAbiertasAlta} de gravedad ALTA`,
    },
    {
      id: "atencion",
      nombre: "Tiempo medio de atención",
      valor: resumen.tiempoMedioAtencionMin === null ? "—" : `${resumen.tiempoMedioAtencionMin} min`,
      nota: resumen.tiempoMedioAtencionMin === null ? "Sin alertas resueltas en las últimas 24 h" : undefined,
    },
  ]
}

/** Shape LatestAlertsTable already renders (lib/oficina/mock-data.ts's
 * AlertaOficina, narrowed to the fields this table needs) -- a real
 * AlertaResumenOficina row has no chart/8D/history backing data, so it is
 * never passed off as a full AlertaOficina. */
export type FilaTablaAlertas = Pick<AlertaOficina, "id" | "gravedad" | "titulo" | "lineaEstacion" | "estado" | "hace">

const GRAVEDAD_MAP: Record<AlertaResumenOficina["severidad"], SeveridadOficina> = {
  parar: "ALTA",
  atencion: "MEDIA",
  ok: "BAJA",
}

/** Maps the "Últimas alertas" rows (any severity/estado, newest first as the
 * repository already returns them) onto the table's display shape. */
export function resumenOficinaAFilasTabla(resumen: ResumenOficina): FilaTablaAlertas[] {
  return resumen.ultimasAlertas.map((alerta) => ({
    id: alerta.id,
    gravedad: GRAVEDAD_MAP[alerta.severidad],
    titulo: alerta.titulo,
    lineaEstacion: alerta.estacion ? `${alerta.linea} - ${alerta.estacion}` : alerta.linea,
    estado: ESTADO_MAP[alerta.estado],
    hace: haceCuanto(alerta.creadaEn),
  }))
}
