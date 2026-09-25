"use client"

import { useEffect, useRef, useState } from "react"
import { LogOut } from "lucide-react"
import { formatearHora, PLANTA_NOMBRE, type Alerta, type Usuario } from "@/lib/mock-data"
import { useApp } from "./app-provider"
import { IndicatorsRow } from "./indicators-row"
import { AlertStack } from "./alert-stack"
import { AlertDetail } from "./alert-detail"
import { SinceLastVisit } from "./since-last-visit"

export function Dashboard({ usuario }: { usuario: Usuario }) {
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
      <header className="flex items-center justify-between rounded-2xl border-4 border-neutral-200 bg-white px-5 py-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-black text-neutral-900">{PLANTA_NOMBRE}</h1>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <span className="text-[24px] font-bold text-neutral-700">Línea 3 · Motores</span>
            <span className="text-[24px] font-semibold text-neutral-600">Turno mañana</span>
            {montado && ultimaActualizacion !== null && (
              <span className="text-[24px] font-semibold text-neutral-500">
                Última actualización {formatearHora(ultimaActualizacion)}
              </span>
            )}
          </div>
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
            className="flex h-24 min-w-[96px] items-center justify-center gap-3 rounded-2xl border-4 border-neutral-300 px-6 text-[24px] font-black text-neutral-900"
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
