"use client"

import { Clock, MapPin } from "lucide-react"
import { haceCuanto, type Alerta, type Severidad } from "@/lib/mock-data"
import { ESTILOS } from "@/lib/status"

const SEVERIDAD_PALABRA: Record<Severidad, string> = {
  parar: "ALTA",
  atencion: "MEDIA",
  ok: "BAJA",
}

export function AlertStack({
  alertas,
  onAbrir,
  nuevasIds,
}: {
  alertas: Alerta[]
  onAbrir: (a: Alerta) => void
  nuevasIds: Set<string>
}) {
  const visibles = alertas.slice(0, 3)
  const restantes = alertas.length - visibles.length

  if (alertas.length === 0) {
    const e = ESTILOS.ok
    return (
      <div className={`flex flex-1 items-center justify-center rounded-2xl border-4 ${e.fondo} ${e.borde} ${e.textoSobreFondo}`}>
        <p className="text-[32px] font-black">Sin alertas abiertas</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {visibles.map((a, i) => (
        <AlertCard key={a.id} alerta={a} destacada={i === 0} nueva={nuevasIds.has(a.id)} onAbrir={onAbrir} />
      ))}
      {restantes > 0 && (
        <div className="flex items-center justify-center rounded-2xl border-4 border-dashed border-neutral-400 py-3 text-[24px] font-black text-neutral-600">
          +{restantes} {restantes === 1 ? "alerta menos grave" : "alertas menos graves"}
        </div>
      )}
    </div>
  )
}

function AlertCard({
  alerta,
  destacada,
  nueva,
  onAbrir,
}: {
  alerta: Alerta
  destacada: boolean
  nueva: boolean
  onAbrir: (a: Alerta) => void
}) {
  const e = ESTILOS[alerta.severidad]
  const Icono = e.Icono
  return (
    <button
      type="button"
      onClick={() => onAbrir(alerta)}
      className={`relative flex w-full min-h-0 items-center gap-5 overflow-hidden rounded-2xl border-4 px-6 text-left ${e.fondo} ${e.borde} ${e.textoSobreFondo} ${
        destacada ? "flex-[5] py-4" : "flex-[3] py-3"
      }`}
    >
      {nueva && (
        <span className="absolute right-5 top-5 flex items-center">
          <span className="h-5 w-5 rounded-full bg-current" aria-hidden />
          <span className="sr-only">Nueva</span>
        </span>
      )}
      <Icono
        className={destacada ? "h-24 w-24 shrink-0" : "h-14 w-14 shrink-0"}
        strokeWidth={2.5}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className={`font-black uppercase leading-none ${destacada ? "text-[48px]" : "text-[26px]"}`}>
          {SEVERIDAD_PALABRA[alerta.severidad]}
        </p>
        <p
          className={`mt-2 font-bold leading-tight ${destacada ? "text-[34px]" : "text-[24px]"}`}
        >
          {alerta.titulo}
        </p>
        <div
          className={`mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 font-semibold ${
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
    </button>
  )
}
