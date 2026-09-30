"use client"

import { KpiCard } from "@/components/oficina/kpi-card"
import { LatestAlertsTable } from "@/components/oficina/latest-alerts-table"
import { useResumenOficina } from "@/components/oficina/resumen-provider"
import { resumenOficinaAFilasTabla, resumenOficinaAKpis } from "@/lib/oficina/resumen-vista"

/** G10: the 5 KPI cards (fpy/dph/scrap plant averages, alertas abiertas,
 * tiempo medio de atención), live from ResumenOficinaProvider. `resumen`
 * is only null after every fetch (the initial server one and every poll)
 * has failed -- an honest "no data" notice instead of ever falling back to
 * the old static sample KPIS (those numbers are fabricated; showing them
 * here would pass them off as real). */
export function ResumenKpis() {
  const { resumen } = useResumenOficina()
  if (!resumen) {
    return <p className="text-sm text-muted-foreground">No se pudo cargar el resumen de planta.</p>
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {resumenOficinaAKpis(resumen).map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  )
}

/** G10: "Últimas alertas" table, live from ResumenOficinaProvider -- any
 * severity/estado, across every known line, linking to the real alert
 * investigation screen (`/oficina/alertas/<real id>`). */
export function ResumenAlertasTable() {
  const { resumen } = useResumenOficina()
  if (!resumen) {
    return <p className="text-sm text-muted-foreground">No se pudo cargar las alertas.</p>
  }
  if (resumen.ultimasAlertas.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin alertas registradas.</p>
  }
  return <LatestAlertsTable alertas={resumenOficinaAFilasTabla(resumen)} />
}
