import { Check } from "lucide-react"
import type { AlertaOficina } from "@/lib/oficina/mock-data"

export function EightDPanel({
  pasos,
  progreso,
}: {
  pasos: AlertaOficina["ocho_d"]
  progreso: string
}) {
  if (pasos.length === 0) {
    return <p className="text-sm text-muted-foreground">Análisis de causa raíz (8D) no iniciado.</p>
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Abierto por Beto Cruz · {progreso}</p>
      <ul className="flex flex-col gap-2">
        {pasos.map((p) => (
          <li key={p.paso} className="flex items-center gap-2 text-sm">
            <span
              className={
                p.completado
                  ? "flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white"
                  : "flex size-4 items-center justify-center rounded-full bg-neutral-300"
              }
              aria-hidden
            >
              {p.completado && <Check className="size-3" strokeWidth={3} />}
            </span>
            {p.paso}
          </li>
        ))}
      </ul>
    </div>
  )
}
