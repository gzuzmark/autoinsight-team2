"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"
import type { Alerta, Usuario } from "@/lib/mock-data"
import { useApp } from "./app-provider"
import { IndicatorsRow } from "./indicators-row"
import { AlertStack } from "./alert-stack"
import { AlertDetail } from "./alert-detail"

export function Dashboard({ usuario }: { usuario: Usuario }) {
  const { alertasActivas, salir } = useApp()
  const [abierta, setAbierta] = useState<Alerta | null>(null)

  function abrir(a: Alerta) {
    setAbierta(a)
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4">
      <header className="flex items-center justify-between rounded-2xl border-4 border-neutral-200 bg-white px-5 py-3">
        <div className="flex items-baseline gap-5">
          <h1 className="text-[30px] font-black text-neutral-900">Línea 3 · Motores</h1>
          <span className="text-[22px] font-bold text-neutral-600">Turno mañana</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-black text-white"
              style={{ backgroundColor: usuario.color }}
            >
              {usuario.iniciales}
            </span>
            <span className="text-[24px] font-bold text-neutral-900">{usuario.nombre}</span>
          </div>
          <button
            type="button"
            onClick={salir}
            className="flex h-16 items-center gap-3 rounded-2xl border-4 border-neutral-300 px-5 text-[22px] font-black text-neutral-900 transition-colors active:border-neutral-900"
          >
            <LogOut className="h-8 w-8" strokeWidth={2.5} aria-hidden />
            Salir
          </button>
        </div>
      </header>

      <IndicatorsRow />

      <AlertStack alertas={alertasActivas} onAbrir={abrir} />

      {abierta && <AlertDetail alerta={abierta} onCerrar={() => setAbierta(null)} />}
    </div>
  )
}
