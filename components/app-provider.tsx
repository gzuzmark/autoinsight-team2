"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { api, type LoginResult } from "@/lib/api/client"
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
