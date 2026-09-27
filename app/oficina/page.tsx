import { OfficeShell } from "@/components/oficina/office-shell"
import { FilterBar } from "@/components/oficina/filter-bar"
import { KpiCard } from "@/components/oficina/kpi-card"
import { FpyTrendChart } from "@/components/oficina/fpy-trend-chart"
import { ParetoDefectos } from "@/components/oficina/pareto-defectos"
import { AlertHeatmap } from "@/components/oficina/alert-heatmap"
import { LatestAlertsTable } from "@/components/oficina/latest-alerts-table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { KPIS, FPY_TENDENCIA, PARETO_DEFECTOS, TOTAL_DEFECTOS_PARETO, HEATMAP_ALERTAS, ALERTAS } from "@/lib/oficina/mock-data"

// Screen 01 (Resumen de planta, O2): static desk view, no API calls (O-D4).
export default function ResumenPage() {
  return (
    <OfficeShell pathname="/oficina" title="Resumen de planta" subtitle="Planta Norte · actualizado hace 1 min">
      <div className="flex flex-col gap-4">
        <FilterBar />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {KPIS.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tendencia de FPY · Línea 3</CardTitle>
              <CardDescription>FPY diario de los últimos 30 días, coloreado por umbral</CardDescription>
            </CardHeader>
            <CardContent>
              <FpyTrendChart puntos={FPY_TENDENCIA} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pareto de defectos</CardTitle>
            </CardHeader>
            <CardContent>
              <ParetoDefectos causas={PARETO_DEFECTOS} total={TOTAL_DEFECTOS_PARETO} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Alertas por línea y estación</CardTitle>
              <CardDescription>Últimos 7 días</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertHeatmap filas={HEATMAP_ALERTAS} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimas alertas</CardTitle>
              <CardDescription>Todas las líneas</CardDescription>
            </CardHeader>
            <CardContent>
              <LatestAlertsTable alertas={ALERTAS} />
            </CardContent>
          </Card>
        </div>
      </div>
    </OfficeShell>
  )
}
