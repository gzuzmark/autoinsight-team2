"use client"

import { useEffect, useRef } from "react"
import { ArrowLeft, Check, Clock, MapPin, X } from "lucide-react"
import { haceCuanto, type Alerta } from "@/lib/mock-data"
import { ESTILOS, SEVERIDAD_PALABRA } from "@/lib/status"

export function AlertDetail({
  alerta,
  onAtender,
  onNoAplica,
  onCerrar,
}: {
  alerta: Alerta
  /** Marks the alert atendida AND closes the panel (F3: caller decides where focus goes next, since the trigger card unmounts). */
  onAtender: () => void
  /** Marks the alert no_aplica AND closes the panel (see onAtender). */
  onNoAplica: () => void
  /** Plain close (Escape / "Volver"): the alert is untouched, so focus returns to the trigger that opened it. */
  onCerrar: () => void
}) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-detail-heading"
    >
      <div className={`flex flex-wrap items-center gap-5 border-b-4 p-6 ${e.fondo} ${e.borde} ${e.textoSobreFondo}`}>
        <Icono className="h-20 w-20 shrink-0" strokeWidth={2.5} aria-hidden />
        {/* D11/D27: without basis-full this flex-1 min-w-0 box shrinks toward
            0 next to the icon + "Volver" button instead of wrapping (flex-1's
            zero basis never triggers flex-wrap), clipping the severity word
            as low as 360-414px wide (measured live; see
            odd/tasks/guerrilla-backoffice.md, bug 2026-09-29 entry). Forcing
            its own full-width line below kiosk gives it the whole header
            width instead. */}
        <div className="min-w-0 flex-1 basis-full kiosk:basis-auto">
          <p className="break-words text-5xl font-black uppercase leading-none">{SEVERIDAD_PALABRA[alerta.severidad]}</p>
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

      <div className="flex flex-1 flex-col justify-center gap-6 overflow-y-auto px-6 py-6 kiosk:px-10 kiosk:py-0">
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

      <div className="grid grid-cols-1 gap-4 border-t-4 border-neutral-200 p-6 kiosk:grid-cols-2">
        <button
          type="button"
          onClick={onAtender}
          className="flex h-28 items-center justify-center gap-4 rounded-2xl border-4 border-neutral-900 bg-neutral-900 text-3xl font-black text-white"
        >
          <Check className="h-12 w-12" strokeWidth={2.5} aria-hidden />
          Atendida
        </button>
        <button
          type="button"
          onClick={onNoAplica}
          className="flex h-28 items-center justify-center gap-4 rounded-2xl border-4 border-neutral-400 bg-white text-3xl font-black text-neutral-900"
        >
          <X className="h-12 w-12" strokeWidth={2.5} aria-hidden />
          No aplica
        </button>
      </div>
    </div>
  )
}
