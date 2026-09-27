import { ArrowDown, ArrowUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Kpi } from "@/lib/oficina/mock-data"

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const Flecha = kpi.tendencia === "up" ? ArrowUp : ArrowDown
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground">{kpi.nombre}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="text-2xl font-bold">{kpi.valor}</span>
        <span className={kpi.favorable ? "flex items-center gap-1 text-xs font-semibold text-emerald-700" : "flex items-center gap-1 text-xs font-semibold text-red-700"}>
          <Flecha className="size-3" aria-hidden />
          {kpi.delta}
        </span>
        {kpi.nota && <span className="text-xs text-muted-foreground">{kpi.nota}</span>}
      </CardContent>
    </Card>
  )
}
