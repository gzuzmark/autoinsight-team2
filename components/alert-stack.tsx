"use client"

import { Clock, MapPin } from "lucide-react"
import { haceCuanto, type Alerta } from "@/lib/mock-data"
import { ESTILOS, SEVERIDAD_PALABRA } from "@/lib/status"

export function AlertStack({
  alertas,
  onAbrir,
  nuevasIds,
}: {
  alertas: Alerta[]
  onAbrir: (a: Alerta, el: HTMLButtonElement) => void
  nuevasIds: Set<string>
}) {
  const visibles = alertas.slice(0, 3)
  const restantes = alertas.length - visibles.length

  if (alertas.length === 0) {
    const e = ESTILOS.ok
    return (
      <div className={`flex flex-1 items-center justify-center rounded-2xl border-4 ${e.fondo} ${e.borde} ${e.textoSobreFondo}`}>
        <p className="text-3xl font-black">Sin alertas abiertas</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {visibles.map((a, i) =>
        i === 0 ? (
          <TopAlertCard key={a.id} alerta={a} nueva={nuevasIds.has(a.id)} onAbrir={onAbrir} />
        ) : (
          <SecondaryAlertCard key={a.id} alerta={a} nueva={nuevasIds.has(a.id)} onAbrir={onAbrir} />
        ),
      )}
      {restantes > 0 && (
        <div className="flex h-14 shrink-0 items-center justify-center rounded-2xl border-4 border-dashed border-neutral-400 text-2xl font-black text-neutral-900">
          +{restantes} {restantes === 1 ? "alerta menos grave" : "alertas menos graves"}
        </div>
      )}
    </div>
  )
}

function TopAlertCard({
  alerta,
  nueva,
  onAbrir,
}: {
  alerta: Alerta
  nueva: boolean
  onAbrir: (a: Alerta, el: HTMLButtonElement) => void
}) {
  const e = ESTILOS[alerta.severidad]
  const Icono = e.Icono
  return (
    <button
      type="button"
      onClick={(ev) => onAbrir(alerta, ev.currentTarget)}
      className={`relative flex min-h-35 flex-1 items-center gap-5 rounded-2xl border-4 px-6 py-4 text-left ${e.fondo} ${e.borde} ${e.textoSobreFondo}`}
    >
      {nueva && <NuevaDot />}
      <Icono className="h-24 w-24 shrink-0" strokeWidth={2.5} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-5xl font-black uppercase leading-none">{SEVERIDAD_PALABRA[alerta.severidad]}</p>
        <p className="mt-2 text-4xl font-bold leading-tight">{alerta.titulo}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-2xl font-semibold">
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

/** Fila única (icono + palabra + título + estación + hora) para no recortar contenido en el espacio de 88px. */
function SecondaryAlertCard({
  alerta,
  nueva,
  onAbrir,
}: {
  alerta: Alerta
  nueva: boolean
  onAbrir: (a: Alerta, el: HTMLButtonElement) => void
}) {
  const e = ESTILOS[alerta.severidad]
  const Icono = e.Icono
  return (
    <button
      type="button"
      onClick={(ev) => onAbrir(alerta, ev.currentTarget)}
      className={`relative flex h-22 shrink-0 items-center gap-4 rounded-2xl border-4 px-5 text-left ${e.fondo} ${e.borde} ${e.textoSobreFondo}`}
    >
      {nueva && <NuevaDot />}
      <Icono className="h-10 w-10 shrink-0" strokeWidth={2.5} aria-hidden />
      <span className="shrink-0 text-2xl font-black uppercase leading-none">
        {SEVERIDAD_PALABRA[alerta.severidad]}
      </span>
      <span className="min-w-0 flex-1 truncate text-2xl font-bold leading-none">{alerta.titulo}</span>
      <span className="flex shrink-0 items-center gap-2 text-2xl font-semibold leading-none">
        <MapPin className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        {alerta.estacion}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-2xl font-semibold leading-none">
        <Clock className="h-6 w-6" strokeWidth={2.5} aria-hidden />
        {haceCuanto(alerta.timestamp)}
      </span>
    </button>
  )
}

function NuevaDot() {
  return (
    <span className="absolute right-4 top-4 flex items-center">
      <span className="h-5 w-5 rounded-full bg-current" aria-hidden />
      <span className="sr-only">Nueva</span>
    </span>
  )
}
