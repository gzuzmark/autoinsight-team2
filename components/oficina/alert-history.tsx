import type { EventoHistorial } from "@/lib/oficina/mock-data"

const COLOR_PUNTO: Record<EventoHistorial["estado"], string> = {
  ok: "bg-emerald-600",
  atencion: "bg-amber-500",
  parar: "bg-red-500",
  info: "bg-indigo-500",
}

export function AlertHistory({ eventos }: { eventos: EventoHistorial[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {eventos.map((e, i) => (
        <li key={i} className="flex gap-3">
          <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${COLOR_PUNTO[e.estado]}`} aria-hidden />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{e.hora}</span>
            <span className="text-sm font-semibold">{e.titulo}</span>
            <span className="text-xs text-muted-foreground">{e.detalle}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}
