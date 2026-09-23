"use client"

import { Clock, MapPin, ThumbsDown, ThumbsUp } from "lucide-react"
import { haceCuanto, type Alerta } from "@/lib/mock-data"
import { ESTILOS } from "@/lib/status"

export function AlertStack({
  alertas,
  onAbrir,
}: {
  alertas: Alerta[]
  onAbrir: (a: Alerta) => void
}) {
  const visibles = alertas.slice(0, 3)
  const restantes = alertas.length - visibles.length

  if (alertas.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl border-4 border-[#053d20] bg-[#0b5d33] text-white">
        <p className="text-[32px] font-black">Sin alertas activas · Línea OK</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {visibles.map((a, i) => (
        <AlertCard key={a.id} alerta={a} destacada={i === 0} onAbrir={onAbrir} />
      ))}
      {restantes > 0 && (
        <div className="flex items-center justify-center rounded-2xl border-4 border-dashed border-neutral-400 py-3 text-[24px] font-black text-neutral-600">
          +{restantes} {restantes === 1 ? "alerta más" : "alertas más"}
        </div>
      )}
    </div>
  )
}

function AlertCard({
  alerta,
  destacada,
  onAbrir,
}: {
  alerta: Alerta
  destacada: boolean
  onAbrir: (a: Alerta) => void
}) {
  const e = ESTILOS[alerta.severidad]
  const Icono = e.Icono
  return (
    <button
      type="button"
      onClick={() => onAbrir(alerta)}
      className={`flex w-full min-h-0 items-center gap-5 overflow-hidden rounded-2xl border-4 px-6 text-left transition-transform active:scale-[0.99] ${e.fondo} ${e.borde} ${e.textoSobreFondo} ${
        destacada ? "flex-[5] py-4" : "flex-[3] py-3"
      }`}
    >
      <Icono
        className={destacada ? "h-24 w-24 shrink-0" : "h-14 w-14 shrink-0"}
        strokeWidth={2.5}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className={`font-black uppercase leading-none ${destacada ? "text-[48px]" : "text-[26px]"}`}>
          {e.palabra}
        </p>
        <p
          className={`mt-2 font-bold leading-tight ${destacada ? "text-[34px]" : "text-[24px]"}`}
        >
          {alerta.titulo}
        </p>
        <div
          className={`mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 font-semibold opacity-95 ${
            destacada ? "text-[24px]" : "text-[20px]"
          }`}
        >
          <span className="flex items-center gap-2">
            <MapPin className="h-6 w-6" strokeWidth={2.5} aria-hidden />
            {alerta.estacion}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="h-6 w-6" strokeWidth={2.5} aria-hidden />
            {haceCuanto(alerta.timestamp)}
          </span>
        </div>
      </div>
      {alerta.feedback && (
        <span
          className="flex shrink-0 items-center gap-2 rounded-xl bg-black/25 px-4 py-2 text-[20px] font-black"
          aria-label={alerta.feedback === "util" ? "Marcada como útil" : "Marcada como no útil"}
        >
          {alerta.feedback === "util" ? (
            <ThumbsUp className="h-7 w-7" strokeWidth={2.5} aria-hidden />
          ) : (
            <ThumbsDown className="h-7 w-7" strokeWidth={2.5} aria-hidden />
          )}
          {alerta.feedback === "util" ? "Útil" : "No útil"}
        </span>
      )}
    </button>
  )
}
