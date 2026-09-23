"use client"

import { RefreshCw } from "lucide-react"
import { useApp } from "./app-provider"

export function DemoControls() {
  const { simularCambioTurno } = useApp()
  return (
    <button
      type="button"
      onClick={simularCambioTurno}
      className="fixed bottom-5 right-5 z-30 flex h-16 items-center gap-3 rounded-2xl border-4 border-neutral-900 bg-white px-5 text-[20px] font-black text-neutral-900 shadow-lg transition-transform active:scale-[0.97]"
    >
      <RefreshCw className="h-7 w-7" strokeWidth={2.5} aria-hidden />
      Simular cambio de turno
    </button>
  )
}
