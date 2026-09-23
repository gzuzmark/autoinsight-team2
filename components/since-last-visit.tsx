"use client"

import { ArrowRight } from "lucide-react"
import type { Alerta } from "@/lib/mock-data"
import { ESTILOS } from "@/lib/status"

export function SinceLastVisit({
  cambios,
  onContinuar,
}: {
  cambios: Alerta[]
  onContinuar: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-neutral-900 px-10 py-8 text-white">
      <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col justify-center gap-8">
        <div>
          <p className="text-[24px] font-bold uppercase tracking-wide text-neutral-400">
            Desde tu última visita
          </p>
          <h2 className="mt-1 text-[44px] font-black leading-tight">
            {cambios.length} {cambios.length === 1 ? "alerta nueva" : "alertas nuevas"} en tu línea
          </h2>
        </div>

        <ul className="flex flex-col gap-4">
          {cambios.slice(0, 4).map((a) => {
            const e = ESTILOS[a.severidad]
            const Icono = e.Icono
            return (
              <li
                key={a.id}
                className={`flex items-center gap-5 rounded-2xl border-4 p-4 ${e.fondo} ${e.borde} ${e.textoSobreFondo}`}
              >
                <Icono className="h-14 w-14 shrink-0" strokeWidth={2.5} aria-hidden />
                <div>
                  <p className="text-[24px] font-black uppercase leading-none">{e.palabra}</p>
                  <p className="mt-1 text-[26px] font-bold leading-tight">{a.titulo}</p>
                  <p className="text-[20px] font-semibold opacity-95">{a.estacion}</p>
                </div>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={onContinuar}
          className="flex h-24 items-center justify-center gap-4 rounded-2xl border-4 border-white bg-white text-[32px] font-black text-neutral-900 transition-transform active:scale-[0.99]"
        >
          Ver mi línea
          <ArrowRight className="h-10 w-10" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </div>
  )
}
