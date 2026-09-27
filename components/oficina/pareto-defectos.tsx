import type { DefectoPareto } from "@/lib/oficina/mock-data"

export function ParetoDefectos({ causas, total }: { causas: DefectoPareto[]; total: number }) {
  const max = causas[0]?.cantidad ?? 1
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {total} defectos · 5 causas explican el 85 %
      </p>
      <ul className="flex flex-col gap-2">
        {causas.map((c) => (
          <li key={c.causa} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm">{c.causa}</span>
            <div className="h-3 flex-1 rounded-full bg-neutral-100">
              <div
                className="h-3 rounded-full bg-indigo-600"
                style={{ width: `${Math.round((c.cantidad / max) * 100)}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
              {c.porcentajeAcumulado}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
