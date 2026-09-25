"use client"

import { useEffect, useState } from "react"
import type { Usuario } from "@/lib/mock-data"
import { AppProvider, useApp } from "@/components/app-provider"
import { LoginAvatars } from "@/components/login-avatars"
import { PinPad } from "@/components/pin-pad"
import { Dashboard } from "@/components/dashboard"
import { DemoControls } from "@/components/demo-controls"

export default function Page() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}

function Shell() {
  const { usuario, ingresar } = useApp()
  const [seleccionado, setSeleccionado] = useState<Usuario | null>(null)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    setDemo(new URLSearchParams(window.location.search).get("demo") === "1")
  }, [])

  return (
    <main className="h-dvh w-full overflow-hidden bg-neutral-100 text-neutral-900">
      {!usuario ? (
        seleccionado ? (
          <PinPad
            usuario={seleccionado}
            onVolver={() => setSeleccionado(null)}
            onConfirmar={() => {
              ingresar(seleccionado)
              setSeleccionado(null)
            }}
          />
        ) : (
          <LoginAvatars onSeleccionar={setSeleccionado} />
        )
      ) : (
        <>
          <Dashboard usuario={usuario} />
          {demo && <DemoControls />}
        </>
      )}
    </main>
  )
}
