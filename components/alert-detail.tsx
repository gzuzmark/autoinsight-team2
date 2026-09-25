"use client"

import { ArrowLeft, Check, Clock, MapPin, X } from "lucide-react"
import { haceCuanto, type Alerta } from "@/lib/mock-data"
import { ESTILOS } from "@/lib/status"
import { useApp } from "./app-provider"

export function AlertDetail({ alerta, onCerrar }: { alerta: Alerta; onCerrar: () => void }) {
  const { marcarAtendida, marcarNoAplica } = useApp()
  const e = ESTILOS[alerta.severidad]
  const Icono = e.Icono

  function atender() {
    marcarAtendida(alerta.id)
    onCerrar()
  }

  function noAplica() {
    marcarNoAplica(alerta.id)
    onCerrar()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className={`flex items-center gap-5 border-b-4 p-6 ${e.fondo} ${e.borde} ${e.textoSobreFondo}`}>
        <Icono className="h-20 w-20 shrink-0" strokeWidth={2.5} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[48px] font-black uppercase leading-none">{e.palabra}</p>
          <p className="mt-2 text-[34px] font-bold leading-tight">{alerta.titulo}</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="flex h-20 items-center gap-3 rounded-2xl border-4 border-current px-6 text-[24px] font-black"
        >
          <ArrowLeft className="h-9 w-9" strokeWidth={2.5} aria-hidden />
          Volver
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6 px-10">
        <div className="flex flex-wrap gap-x-12 gap-y-4 text-[28px] font-bold text-neutral-800">
          <span className="flex items-center gap-3">
            <MapPin className="h-9 w-9" strokeWidth={2.5} aria-hidden />
            {alerta.estacion}
          </span>
          <span className="flex items-center gap-3">
            <Clock className="h-9 w-9" strokeWidth={2.5} aria-hidden />
            {haceCuanto(alerta.timestamp)}
          </span>
        </div>
        <p className="max-w-[900px] text-[26px] font-semibold leading-snug text-neutral-700">
          Revisa la estación indicada y confirma la desviación. Cuando termines, marca esta alerta
          para cerrar el ciclo y dejar registro para el siguiente turno.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t-4 border-neutral-200 p-6">
        <button
          type="button"
          onClick={atender}
          className="flex h-28 items-center justify-center gap-4 rounded-2xl border-4 border-neutral-900 bg-neutral-900 text-[32px] font-black text-white"
        >
          <Check className="h-12 w-12" strokeWidth={2.5} aria-hidden />
          Atendida
        </button>
        <button
          type="button"
          onClick={noAplica}
          className="flex h-28 items-center justify-center gap-4 rounded-2xl border-4 border-neutral-400 bg-white text-[32px] font-black text-neutral-900"
        >
          <X className="h-12 w-12" strokeWidth={2.5} aria-hidden />
          No aplica
        </button>
      </div>
    </div>
  )
}
