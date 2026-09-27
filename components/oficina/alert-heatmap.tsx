import { heatmapBucket, ESTACIONES_HEATMAP, type FilaHeatmap } from "@/lib/oficina/mock-data"

const COLOR_POR_BUCKET: Record<ReturnType<typeof heatmapBucket>, string> = {
  "0": "bg-emerald-100",
  "1-2": "bg-amber-100",
  "3-5": "bg-orange-300",
  "6+": "bg-red-400",
}

export function AlertHeatmap({ filas }: { filas: FilaHeatmap[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-8 gap-1 text-center text-xs text-muted-foreground">
        <span />
        {ESTACIONES_HEATMAP.map((e) => (
          <span key={e}>{e}</span>
        ))}
      </div>
      {filas.map((fila) => (
        <div key={fila.linea} className="grid grid-cols-8 items-center gap-1">
          <span className="truncate text-xs">{fila.linea}</span>
          {fila.conteos.map((c, i) => (
            <div
              key={i}
              className={`h-6 rounded ${COLOR_POR_BUCKET[heatmapBucket(c)]}`}
              title={`${fila.linea} · ${ESTACIONES_HEATMAP[i]}: ${c} alertas`}
            />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Leyenda color="bg-emerald-100" texto="0 alertas" />
        <Leyenda color="bg-amber-100" texto="1-2" />
        <Leyenda color="bg-orange-300" texto="3-5" />
        <Leyenda color="bg-red-400" texto="6+" />
      </div>
    </div>
  )
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-3 rounded ${color}`} aria-hidden />
      {texto}
    </span>
  )
}
