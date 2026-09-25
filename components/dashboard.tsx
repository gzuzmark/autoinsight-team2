"use client"

import { useEffect, useRef, useState } from "react"
import { LogOut } from "lucide-react"
import { formatearHora, PLANTA_NOMBRE, type Alerta, type Usuario } from "@/lib/mock-data"
import { useApp } from "./app-provider"
import { IndicatorsRow } from "./indicators-row"
import { AlertStack } from "./alert-stack"
import { AlertDetail } from "./alert-detail"
import { SinceLastVisit } from "./since-last-visit"
import { DemoControls } from "./demo-controls"

export function Dashboard({ usuario, demo }: { usuario: Usuario; demo: boolean }) {
  const { alertasActivas, salir, cambiosDesdeUltimaVisita, esPrimeraVisita, ultimoLogoutTs, ultimaActualizacion } =
    useApp()
  const [abierta, setAbierta] = useState<Alerta | null>(null)
  const [montado, setMontado] = useState(false)
  const disparadorRef = useRef<HTMLButtonElement | null>(null)

  // La hora se formatea solo del lado del cliente: `ultimaActualizacion` solo
  // cambia por interacciones (ingresar / simular turno), nunca en el render
  // inicial, así que no hay desajuste de hidratación; igual esperamos al
  // montaje para no depender del reloj/zona horaria del render de servidor.
  useEffect(() => {
    setMontado(true)
  }, [])

  const nuevasIds = new Set(cambiosDesdeUltimaVisita.map((a) => a.id))

  function abrir(a: Alerta, el: HTMLButtonElement) {
    disparadorRef.current = el
    setAbierta(a)
  }

  function cerrarDetalle() {
    setAbierta(null)
    disparadorRef.current?.focus()
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4">
      <header className="flex shrink-0 items-center justify-between gap-4 rounded-2xl border-4 border-neutral-200 bg-white px-5 py-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="whitespace-nowrap text-2xl font-black text-neutral-900">{PLANTA_NOMBRE}</h1>
          <span className="whitespace-nowrap text-2xl font-bold text-neutral-900">Línea 3 · Motores</span>
          <span className="whitespace-nowrap text-2xl font-semibold text-neutral-900">Turno mañana</span>
          {montado && ultimaActualizacion !== null && (
            <span className="whitespace-nowrap text-2xl font-semibold text-neutral-900">
              Última actualización {formatearHora(ultimaActualizacion)}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-black text-white"
              style={{ backgroundColor: usuario.color }}
            >
              {usuario.iniciales}
            </span>
            <span className="whitespace-nowrap text-2xl font-bold text-neutral-900">{usuario.nombre}</span>
          </div>
          {demo && <DemoControls />}
          <button
            type="button"
            onClick={salir}
            className="flex h-22 shrink-0 items-center justify-center gap-3 whitespace-nowrap rounded-2xl border-4 border-neutral-300 px-6 text-2xl font-black text-neutral-900"
          >
            <LogOut className="h-9 w-9" strokeWidth={2.5} aria-hidden />
            Salir
          </button>
        </div>
      </header>

      <SinceLastVisit
        primeraVisita={esPrimeraVisita}
        cambios={cambiosDesdeUltimaVisita}
        ultimoLogoutTs={ultimoLogoutTs}
      />

      <IndicatorsRow />

      <AlertStack alertas={alertasActivas} onAbrir={abrir} nuevasIds={nuevasIds} />

      {abierta && <AlertDetail alerta={abierta} onCerrar={cerrarDetalle} />}
    </div>
  )
}
