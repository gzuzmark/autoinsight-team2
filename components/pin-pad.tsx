"use client"

import { useState } from "react"
import { ArrowLeft, Delete } from "lucide-react"
import type { Usuario } from "@/lib/mock-data"

export function PinPad({
  usuario,
  onConfirmar,
  onVolver,
}: {
  usuario: Usuario
  onConfirmar: () => void
  onVolver: () => void
}) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState(false)

  function agregar(digito: string) {
    if (pin.length >= 4) return
    const siguiente = pin + digito
    setError(false)
    if (siguiente.length === 4) {
      if (siguiente === usuario.pin) {
        setPin(siguiente)
        onConfirmar()
      } else {
        setError(true)
        setPin("")
      }
      return
    }
    setPin(siguiente)
  }

  function borrar() {
    setError(false)
    setPin((p) => p.slice(0, -1))
  }

  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-10">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex h-20 w-20 items-center justify-center rounded-full text-[28px] font-black text-white"
          style={{ backgroundColor: usuario.color }}
        >
          {usuario.iniciales}
        </span>
        <div>
          <p className="text-[22px] font-semibold text-neutral-600">Ingresa tu PIN</p>
          <p className="text-[28px] font-black text-neutral-900">{usuario.nombre}</p>
        </div>
      </div>

      <div className="flex items-center gap-5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-9 w-9 rounded-full border-4 ${
              i < pin.length
                ? "border-neutral-900 bg-neutral-900"
                : error
                  ? "border-[#c1121f] bg-white"
                  : "border-neutral-400 bg-white"
            }`}
          />
        ))}
      </div>

      <p className="h-8 text-[22px] font-bold text-[#c1121f]" role="alert">
        {error ? "PIN incorrecto, intenta de nuevo" : ""}
      </p>

      <div className="grid grid-cols-3 gap-4">
        {teclas.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => agregar(t)}
            className="h-24 w-24 rounded-2xl border-4 border-neutral-300 bg-white text-[40px] font-black text-neutral-900 transition-colors active:border-neutral-900 active:bg-neutral-100"
          >
            {t}
          </button>
        ))}

        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver a la lista de personas"
          className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-neutral-300 bg-white text-neutral-700 transition-colors active:border-neutral-900"
        >
          <ArrowLeft className="h-11 w-11" strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={() => agregar("0")}
          className="h-24 w-24 rounded-2xl border-4 border-neutral-300 bg-white text-[40px] font-black text-neutral-900 transition-colors active:border-neutral-900 active:bg-neutral-100"
        >
          0
        </button>

        <button
          type="button"
          onClick={borrar}
          aria-label="Borrar último dígito"
          className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-neutral-300 bg-white text-neutral-700 transition-colors active:border-neutral-900"
        >
          <Delete className="h-11 w-11" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
