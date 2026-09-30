import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { KpiVista } from "@/lib/oficina/resumen-vista"

/**
 * G10: renders a real office Resumen KPI (plant average or open-alert/
 * attention-time count) -- no delta/trend arrow any more (there is no
 * period-over-period comparison data yet; G10 removed the sample deltas
 * rather than fabricate one, see AGENTS.md's "never fabricate a number"
 * convention). `kpi.tooltip`, when present, is the per-line breakdown for
 * an indicator card (fpy/dph/scrap), shown as a native title tooltip.
 */
export function KpiCard({ kpi }: { kpi: KpiVista }) {
  return (
    <Card title={kpi.tooltip}>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground">{kpi.nombre}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="text-2xl font-bold">{kpi.valor}</span>
        {kpi.nota && <span className="text-xs text-muted-foreground">{kpi.nota}</span>}
      </CardContent>
    </Card>
  )
}
