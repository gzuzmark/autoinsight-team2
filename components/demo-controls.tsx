"use client"

import { RefreshCw } from "lucide-react"
import { useApp } from "./app-provider"

export function DemoControls() {
  const { simularCambioTurno } = useApp()
  return (
    <button
      type="button"
      onClick={simularCambioTurno}
      className="flex h-22 shrink-0 items-center gap-3 whitespace-nowrap rounded-2xl border-4 border-neutral-900 bg-white px-6 text-2xl font-black text-neutral-900"
    >
      <RefreshCw className="h-8 w-8" strokeWidth={2.5} aria-hidden />
      Simular turno
    </button>
  )
}
