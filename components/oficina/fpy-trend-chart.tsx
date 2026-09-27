import { fpyBarEstado, fpyBarHeightPercent, type PuntoFpy } from "@/lib/oficina/mock-data"

// Plain-div bar chart (no charting library): each bar's height is a
// percentage of the container (inline style, not an arbitrary Tailwind
// utility), colored by the same OK/ATENCIÓN/PARAR threshold used on the
// floor, mirroring the mockup's blue/orange/red FPY trend.
const COLOR_POR_ESTADO: Record<ReturnType<typeof fpyBarEstado>, string> = {
  ok: "bg-indigo-600",
  atencion: "bg-amber-500",
  parar: "bg-red-500",
}

export function FpyTrendChart({ puntos }: { puntos: PuntoFpy[] }) {
  return (
    <div className="flex h-40 items-end gap-1" role="img" aria-label="Tendencia de FPY de los últimos 30 días">
      {puntos.map((p) => (
        <div
          key={p.dia}
          className={`w-full rounded-t-sm ${COLOR_POR_ESTADO[fpyBarEstado(p.fpy)]}`}
          style={{ height: `${fpyBarHeightPercent(p.fpy)}%` }}
          title={`Día ${p.dia}: ${p.fpy}% FPY`}
        />
      ))}
    </div>
  )
}
