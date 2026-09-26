"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { api, ApiError, type LoginResult } from "@/lib/api/client"
import { createPoller } from "@/lib/api/poller"
import { derivarVista } from "@/lib/domain/tablero-view"
import type { IndicadorTablero, Linea, Planta, Tablero, UsuarioLogin } from "@/lib/domain/floor-repository"
import type { Alerta } from "@/lib/mock-data"

type AppState = {
  /** null while the initial GET /api/usuarios is in flight. */
  usuarios: UsuarioLogin[] | null
  usuariosError: string | null
  usuario: UsuarioLogin | null
  planta: Planta | null
  linea: Linea | null
  indicadores: IndicadorTablero[]
  alertas: Alerta[]
  alertasActivas: Alerta[]
  cambiosDesdeUltimaVisita: Alerta[]
  totalNuevosDesdeVisita: number
  esPrimeraVisita: boolean
  ultimoLogoutTs: number | null
  ultimaActualizacion: number | null
  /** Set only when a background refresh (resolve/simulate) fails; the
   * dashboard keeps showing the last good tablero underneath. */
  tableroError: string | null
  ingresar: (usuarioId: string, pin: string) => Promise<LoginResult>
  salir: () => void
  marcarAtendida: (id: string) => void
  marcarNoAplica: (id: string) => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [usuarios, setUsuarios] = useState<UsuarioLogin[] | null>(null)
  const [usuariosError, setUsuariosError] = useState<string | null>(null)
  const [tablero, setTablero] = useState<Tablero | null>(null)
  const [tableroError, setTableroError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    api.usuarios().then(
      (u) => {
        if (!cancelado) setUsuarios(u)
      },
      () => {
        if (!cancelado) setUsuariosError("No se pudo cargar la lista de personas.")
      },
    )
    return () => {
      cancelado = true
    }
  }, [])

  const refrescarTablero = useCallback(async () => {
    const t = await api.tablero()
    setTablero(t)
    setTableroError(null)
  }, [])

  const ingresar = useCallback(
    async (usuarioId: string, pin: string): Promise<LoginResult> => {
      const resultado = await api.login(usuarioId, pin)
      if (resultado.ok) {
        await refrescarTablero()
      }
      return resultado
    },
    [refrescarTablero],
  )

  const salir = useCallback(() => {
    setTablero(null)
    setTableroError(null)
    void api.logout()
  }, [])

  const marcarAtendida = useCallback((id: string) => {
    api.resolver(id, "atendida").then(setTablero, () => setTableroError("No se pudo actualizar la alerta."))
  }, [])

  const marcarNoAplica = useCallback((id: string) => {
    api.resolver(id, "no_aplica").then(setTablero, () => setTableroError("No se pudo actualizar la alerta."))
  }, [])

  // D29/E4: auto-refresh the tablero every 15s while logged in and the page
  // is visible, instead of an ACTUALIZAR button. `estaLogueado` is a
  // primitive boolean, not `tablero` itself: `tablero` gets a new object
  // reference on every refresh, but the effect must only re-run when going
  // from logged out to logged in (or back) -- not on every tick -- or the
  // interval would never survive long enough to fire.
  const estaLogueado = tablero !== null
  useEffect(() => {
    if (!estaLogueado) return

    const poller = createPoller({
      intervalMs: 15_000,
      isVisible: () => document.visibilityState === "visible",
      onTick: async () => {
        try {
          const t = await api.tablero()
          setTablero(t)
          setTableroError(null)
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            // An expired/invalid session found during a background poll
            // returns to login cleanly: no error banner, no stale
            // dashboard left on screen.
            setTablero(null)
            setTableroError(null)
            return
          }
          // Any other failure keeps showing the last good tablero (no
          // flicker, no loading state) with a background error banner,
          // same as marcarAtendida/marcarNoAplica already do.
          setTableroError("No se pudo actualizar el tablero.")
        }
      },
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
  }, [estaLogueado])

  const vista = useMemo(() => derivarVista(tablero), [tablero])

  const value: AppState = {
    usuarios,
    usuariosError,
    usuario: tablero?.usuario ?? null,
    planta: tablero?.planta ?? null,
    linea: tablero?.linea ?? null,
    indicadores: tablero?.indicadores ?? [],
    alertas: tablero?.alertas ?? [],
    alertasActivas: vista.alertasActivas,
    cambiosDesdeUltimaVisita: vista.cambiosDesdeUltimaVisita,
    totalNuevosDesdeVisita: vista.totalNuevosDesdeVisita,
    esPrimeraVisita: vista.esPrimeraVisita,
    ultimoLogoutTs: vista.ultimoLogoutTs,
    ultimaActualizacion: tablero?.ultimaActualizacion ?? null,
    tableroError,
    ingresar,
    salir,
    marcarAtendida,
    marcarNoAplica,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider")
  return ctx
}
