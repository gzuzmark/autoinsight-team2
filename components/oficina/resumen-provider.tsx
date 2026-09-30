"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { createPoller } from "@/lib/api/poller"
import type { ResumenOficina } from "@/lib/domain/floor-repository"

type EstadoResumen = {
  resumen: ResumenOficina | null
  /** Epoch ms of the last successful fetch this session (client-side
   * hydration counts as "landed" for the initial server-fetched data, same
   * "client-observed liveness" idea as lib/domain/ultima-actualizacion-poll.ts
   * on the floor), or null if every fetch so far has failed. */
  ultimoFetchOk: number | null
}

const ResumenOficinaContext = createContext<EstadoResumen | null>(null)

/**
 * G10: shared client state for the office Resumen screen. A single poller
 * (GET /api/oficina/resumen every 15s while the tab is visible, same
 * lib/api/poller.ts pattern as D29/G9) feeds both the KPI cards/latest-
 * alerts table (`ResumenContenido`) and the header's "actualizado hace X"
 * text (`ResumenSubtitle`) -- one Context instead of two independent
 * pollers so the screen never issues duplicate requests per tick.
 */
export function ResumenOficinaProvider({
  inicial,
  children,
}: {
  inicial: ResumenOficina | null
  children: React.ReactNode
}) {
  const [estado, setEstado] = useState<EstadoResumen>({
    resumen: inicial,
    ultimoFetchOk: inicial ? Date.now() : null,
  })

  const refrescar = useCallback(async () => {
    try {
      const res = await fetch("/api/oficina/resumen", { cache: "no-store" })
      if (!res.ok) return
      const body = (await res.json()) as { resumen: ResumenOficina | null }
      // A degraded { resumen: null } response (route-level failure) keeps
      // showing the last good resumen instead of blanking the screen --
      // same best-effort pattern as the notification bell's own refrescar.
      if (body.resumen) {
        setEstado({ resumen: body.resumen, ultimoFetchOk: Date.now() })
      }
    } catch {
      // Network failure: keep the last good render.
    }
  }, [])

  useEffect(() => {
    const poller = createPoller({
      intervalMs: 15_000,
      isVisible: () => document.visibilityState === "visible",
      onTick: refrescar,
    })
    poller.start()

    function onVisibilityChange() {
      if (document.visibilityState === "visible") poller.notifyVisible()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      poller.stop()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [refrescar])

  return <ResumenOficinaContext.Provider value={estado}>{children}</ResumenOficinaContext.Provider>
}

/** @throws when used outside ResumenOficinaProvider -- both consumers
 * (ResumenSubtitle, ResumenContenido) are only ever rendered inside it from
 * app/oficina/page.tsx. */
export function useResumenOficina(): EstadoResumen {
  const contexto = useContext(ResumenOficinaContext)
  if (!contexto) throw new Error("useResumenOficina must be used within ResumenOficinaProvider")
  return contexto
}
