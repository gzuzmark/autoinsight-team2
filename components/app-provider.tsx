"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { api, ApiError, type LoginResult } from "@/lib/api/client"
import { createPoller } from "@/lib/api/poller"
import { derivarVista } from "@/lib/domain/tablero-view"
import {
  descartarPendientes,
  ESTADO_INICIAL_NUEVAS_ALERTAS,
  registrarPoll,
  type EstadoNuevasAlertas,
} from "@/lib/domain/nuevas-alertas-poll"
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
  /** G7a: alerts newly seen since the strip was last dismissed (or session
   * start), accumulated across 15s polls (D29) -- never populated on the
   * first tablero fetch after login (D9's strip covers that one). */
  nuevasAlertasPoll: Alerta[]
  descartarNuevasAlertasPoll: () => void
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
  const [nuevasAlertasEstado, setNuevasAlertasEstado] = useState<EstadoNuevasAlertas>(
    ESTADO_INICIAL_NUEVAS_ALERTAS,
  )

  // G7a: every successful tablero fetch (login, poll tick, or a
  // resolve-triggered refresh) feeds the pure new-alerts-since-poll
  // reducer. Centralized here so the poller/marcarAtendida/marcarNoAplica
  // below don't each have to remember to call it.
  const aplicarTablero = useCallback((t: Tablero) => {
    setTablero(t)
    setNuevasAlertasEstado((prev) => registrarPoll(prev, t.alertas))
  }, [])

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
    aplicarTablero(t)
    setTableroError(null)
  }, [aplicarTablero])

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
    // G7a: a new session (next login) must start with a clean baseline --
    // no leftover "new alerts" from the previous user's session.
    setNuevasAlertasEstado(ESTADO_INICIAL_NUEVAS_ALERTAS)
    void api.logout()
  }, [])

  const marcarAtendida = useCallback(
    (id: string) => {
      api.resolver(id, "atendida").then(aplicarTablero, () => setTableroError("No se pudo actualizar la alerta."))
    },
    [aplicarTablero],
  )

  const marcarNoAplica = useCallback(
    (id: string) => {
      api.resolver(id, "no_aplica").then(aplicarTablero, () => setTableroError("No se pudo actualizar la alerta."))
    },
    [aplicarTablero],
  )

  const descartarNuevasAlertasPoll = useCallback(() => {
    setNuevasAlertasEstado((prev) => descartarPendientes(prev))
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
          aplicarTablero(t)
          setTableroError(null)
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            // An expired/invalid session found during a background poll
            // returns to login cleanly: no error banner, no stale
            // dashboard left on screen.
            setTablero(null)
            setTableroError(null)
            setNuevasAlertasEstado(ESTADO_INICIAL_NUEVAS_ALERTAS)
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
    nuevasAlertasPoll: [...nuevasAlertasEstado.pendientes],
    descartarNuevasAlertasPoll,
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
