import { barraFueraDeLimite, type DireccionLimite } from "@/lib/oficina/mock-data"

// F2: metric-neutral bar chart, renamed from the old TorqueChart -- it used
// to always label the caption "torque en Nm" and only color a bar red when
// it was *above* the limit, which was wrong for FPY (breach is *below* its
// limit) and mislabeled defects/hour and scrap. Direction-aware via
// barraFueraDeLimite (F2 pure helper, unit-tested).
export function MetricChart({ serie, limite, direccion }: { serie: number[]; limite: number; direccion: DireccionLimite }) {
  const max = Math.max(...serie, limite) * 1.1
  return (
    <div className="flex h-40 items-end gap-2" role="img" aria-label={`Mediciones, límite ${limite}`}>
      {serie.map((valor, i) => {
        const fueraDeLimite = barraFueraDeLimite(valor, limite, direccion)
        // "Close to the limit" (amber): within 10% of the limit's own
        // magnitude on the safe side, same margin the old torque-only chart
        // used, generalized to work for a minimum limit (FPY) too.
        const cercaDelLimite = !fueraDeLimite && Math.abs(valor - limite) <= limite * 0.1
        return (
          <div
            key={i}
            className={`w-full rounded-t-sm ${fueraDeLimite ? "bg-red-500" : cercaDelLimite ? "bg-amber-500" : "bg-indigo-600"}`}
            style={{ height: `${Math.max(6, Math.round((valor / max) * 100))}%` }}
            title={`Medición ${i + 1}: ${valor}`}
          />
        )
      })}
    </div>
  )
}
