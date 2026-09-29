"use client"

import { useState } from "react"
import { ArrowLeft, Delete } from "lucide-react"
import type { UsuarioLogin } from "@/lib/domain/floor-repository"

export function PinPad({
  usuario,
  onIngresar,
  onVolver,
}: {
  usuario: UsuarioLogin
  /** Verifies the PIN server-side (T9: the client never knows a PIN, it
   * only relays it once) and resolves with the outcome. `mensaje` is shown
   * verbatim when present (e.g. the 429 throttle message); otherwise the
   * generic "PIN incorrecto" text is used. */
  onIngresar: (pin: string) => Promise<{ ok: boolean; mensaje?: string }>
  onVolver: () => void
}) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function agregar(digito: string) {
    if (enviando || pin.length >= 4) return
    const siguiente = pin + digito
    setError(null)
    if (siguiente.length === 4) {
      setPin(siguiente)
      setEnviando(true)
      const resultado = await onIngresar(siguiente)
      setEnviando(false)
      if (!resultado.ok) {
        setError(resultado.mensaje ?? "PIN incorrecto, intenta de nuevo")
        setPin("")
      }
      return
    }
    setPin(siguiente)
  }

  function borrar() {
    if (enviando) return
    setError(null)
    setPin((p) => p.slice(0, -1))
  }

  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

  return (
    // G8: ph-no-capture excludes the whole PIN pad from PostHog session
    // replay (belt and suspenders alongside session_recording.maskAllInputs
    // -- lib/analytics/posthog-client.ts) even though the digits themselves
    // are never rendered as text, only as a dot count.
    <div className="ph-no-capture flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4 py-10 kiosk:min-h-full kiosk:gap-8 kiosk:px-10 kiosk:py-0">
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-black text-white"
          style={{ backgroundColor: usuario.color }}
        >
          {usuario.iniciales}
        </span>
        <div>
          <p className="text-2xl font-semibold text-neutral-900">Ingresa tu PIN</p>
          <p className="text-3xl font-black text-neutral-900">{usuario.nombre}</p>
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

      <p className="h-8 text-2xl font-bold text-[#c1121f]" role="alert">
        {error ?? ""}
      </p>

      <div className="grid grid-cols-3 gap-4">
        {teclas.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => agregar(t)}
            className="h-24 w-24 rounded-2xl border-4 border-neutral-300 bg-white text-4xl font-black text-neutral-900 active:border-neutral-900 active:bg-neutral-100"
          >
            {t}
          </button>
        ))}

        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver a la lista de personas"
          className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-neutral-300 bg-white text-neutral-900 active:border-neutral-900"
        >
          <ArrowLeft className="h-11 w-11" strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={() => agregar("0")}
          className="h-24 w-24 rounded-2xl border-4 border-neutral-300 bg-white text-4xl font-black text-neutral-900 active:border-neutral-900 active:bg-neutral-100"
        >
          0
        </button>

        <button
          type="button"
          onClick={borrar}
          aria-label="Borrar último dígito"
          className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-neutral-300 bg-white text-neutral-900 active:border-neutral-900"
        >
          <Delete className="h-11 w-11" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
