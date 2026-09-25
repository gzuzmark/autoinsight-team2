"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { activeAlerts, attendAlert, changesSinceLastVisit, dismissAlert, mergeShiftAlerts } from "@/lib/domain/alerts"
import {
  ALERTAS_INICIALES,
  ALERTAS_NUEVO_TURNO,
  ordenarAlertas,
  type Alerta,
  type Usuario,
} from "@/lib/mock-data"

type AppState = {
  usuario: Usuario | null
  alertas: Alerta[]
  alertasActivas: Alerta[]
  cambiosDesdeUltimaVisita: Alerta[]
  mostrarUltimaVisita: boolean
  ingresar: (usuario: Usuario) => void
  salir: () => void
  cerrarUltimaVisita: () => void
  marcarAtendida: (id: string) => void
  marcarNoAplica: (id: string) => void
  simularCambioTurno: () => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>(() => ordenarAlertas(ALERTAS_INICIALES))
  const [cambiosDesdeUltimaVisita, setCambios] = useState<Alerta[]>([])
  const [mostrarUltimaVisita, setMostrarUltimaVisita] = useState(false)

  // Ids vistos por cada usuario en su último cierre de sesión (baseline de
  // "desde tu última visita"). No se persiste entre recargas de página.
  const vistoPorUsuario = useRef<Record<string, string[]>>({})

  const alertasActivas = useMemo(() => activeAlerts(alertas), [alertas])

  const ingresar = useCallback(
    (u: Usuario) => {
      const vistoAntes = vistoPorUsuario.current[u.id]
      const cambios = changesSinceLastVisit(alertas, vistoAntes)
      if (cambios.length > 0) {
        setCambios(cambios)
        setMostrarUltimaVisita(true)
      }
      setUsuario(u)
    },
    [alertas],
  )

  const salir = useCallback(() => {
    if (usuario) {
      vistoPorUsuario.current[usuario.id] = alertasActivas.map((a) => a.id)
    }
    setUsuario(null)
    setMostrarUltimaVisita(false)
    setCambios([])
  }, [usuario, alertasActivas])

  const cerrarUltimaVisita = useCallback(() => {
    setMostrarUltimaVisita(false)
  }, [])

  const marcarAtendida = useCallback((id: string) => {
    setAlertas((prev) => attendAlert(prev, id))
  }, [])

  const marcarNoAplica = useCallback((id: string) => {
    setAlertas((prev) => dismissAlert(prev, id))
  }, [])

  const simularCambioTurno = useCallback(() => {
    const { alerts, added } = mergeShiftAlerts(alertas, ALERTAS_NUEVO_TURNO, Date.now())
    if (added.length > 0) {
      setCambios(added)
      setMostrarUltimaVisita(true)
    }
    setAlertas(alerts)
  }, [alertas])

  const value: AppState = {
    usuario,
    alertas,
    alertasActivas,
    cambiosDesdeUltimaVisita,
    mostrarUltimaVisita,
    ingresar,
    salir,
    cerrarUltimaVisita,
    marcarAtendida,
    marcarNoAplica,
    simularCambioTurno,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider")
  return ctx
}
