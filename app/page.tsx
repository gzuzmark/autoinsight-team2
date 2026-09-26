"use client"

import { useEffect, useState } from "react"
import type { UsuarioLogin } from "@/lib/domain/floor-repository"
import { AppProvider, useApp } from "@/components/app-provider"
import { LoginAvatars } from "@/components/login-avatars"
import { PinPad } from "@/components/pin-pad"
import { Dashboard } from "@/components/dashboard"

export default function Page() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}

function Shell() {
  const { usuario, usuarios, usuariosError, ingresar } = useApp()
  const [seleccionado, setSeleccionado] = useState<UsuarioLogin | null>(null)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    setDemo(new URLSearchParams(window.location.search).get("demo") === "1")
  }, [])

  async function onIngresar(pin: string): Promise<{ ok: boolean; mensaje?: string }> {
    if (!seleccionado) return { ok: false }
    const resultado = await ingresar(seleccionado.id, pin)
    if (resultado.ok) {
      setSeleccionado(null)
      return { ok: true }
    }
    // D19/T9: 401 keeps the existing "PIN incorrecto" wording regardless of
    // the server's exact message (no enumeration on the client either); a
    // 429 shows the server's throttle message verbatim.
    const mensaje = resultado.status === 429 ? resultado.message : "PIN incorrecto, intenta de nuevo"
    return { ok: false, mensaje }
  }

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-neutral-100 text-neutral-900 kiosk:h-dvh kiosk:overflow-hidden">
      {!usuario ? (
        seleccionado ? (
          <PinPad usuario={seleccionado} onIngresar={onIngresar} onVolver={() => setSeleccionado(null)} />
        ) : usuariosError ? (
          <MensajePantallaCompleta mensaje={usuariosError} />
        ) : usuarios === null ? (
          <MensajePantallaCompleta mensaje="Cargando personas…" />
        ) : (
          <LoginAvatars usuarios={usuarios} onSeleccionar={setSeleccionado} />
        )
      ) : (
        <Dashboard demo={demo} />
      )}
    </main>
  )
}

/** Loading/error full-screen state (D11/D12): large, high-contrast text,
 * no spinner, no animation. */
function MensajePantallaCompleta({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center px-10">
      <p className="text-center text-3xl font-black text-neutral-900">{mensaje}</p>
    </div>
  )
}
