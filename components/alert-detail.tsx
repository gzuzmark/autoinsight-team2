"use client"

import { useEffect, useRef } from "react"
import { ArrowLeft, Check, Clock, MapPin, X } from "lucide-react"
import { haceCuanto, type Alerta } from "@/lib/mock-data"
import { ESTILOS, SEVERIDAD_PALABRA } from "@/lib/status"
import { useApp } from "./app-provider"

export function AlertDetail({ alerta, onCerrar }: { alerta: Alerta; onCerrar: () => void }) {
  const { marcarAtendida, marcarNoAplica } = useApp()
  const e = ESTILOS[alerta.severidad]
  const Icono = e.Icono
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") onCerrar()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onCerrar])

  function atender() {
    marcarAtendida(alerta.id)
    onCerrar()
  }

  function noAplica() {
    marcarNoAplica(alerta.id)
    onCerrar()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-detail-heading"
    >
      <div className={`flex items-center gap-5 border-b-4 p-6 ${e.fondo} ${e.borde} ${e.textoSobreFondo}`}>
        <Icono className="h-20 w-20 shrink-0" strokeWidth={2.5} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-5xl font-black uppercase leading-none">{SEVERIDAD_PALABRA[alerta.severidad]}</p>
          <h2
            id="alert-detail-heading"
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 text-4xl font-bold leading-tight outline-none"
          >
            {alerta.titulo}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="flex h-22 items-center gap-3 rounded-2xl border-4 border-current px-6 text-2xl font-black"
        >
          <ArrowLeft className="h-9 w-9" strokeWidth={2.5} aria-hidden />
          Volver
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6 px-10">
        <div className="flex flex-wrap gap-x-12 gap-y-4 text-4xl font-bold text-neutral-900">
          <span className="flex items-center gap-3">
            <MapPin className="h-9 w-9" strokeWidth={2.5} aria-hidden />
            {alerta.estacion}
          </span>
          <span className="flex items-center gap-3">
            <Clock className="h-9 w-9" strokeWidth={2.5} aria-hidden />
            {haceCuanto(alerta.timestamp)}
          </span>
        </div>
        <p className="max-w-225 text-2xl font-semibold leading-snug text-neutral-900">
          Revisa la estación indicada y confirma la desviación. Cuando termines, marca esta alerta
          para cerrar el ciclo y dejar registro para el siguiente turno.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t-4 border-neutral-200 p-6">
        <button
          type="button"
          onClick={atender}
          className="flex h-28 items-center justify-center gap-4 rounded-2xl border-4 border-neutral-900 bg-neutral-900 text-3xl font-black text-white"
        >
          <Check className="h-12 w-12" strokeWidth={2.5} aria-hidden />
          Atendida
        </button>
        <button
          type="button"
          onClick={noAplica}
          className="flex h-28 items-center justify-center gap-4 rounded-2xl border-4 border-neutral-400 bg-white text-3xl font-black text-neutral-900"
        >
          <X className="h-12 w-12" strokeWidth={2.5} aria-hidden />
          No aplica
        </button>
      </div>
    </div>
  )
}
