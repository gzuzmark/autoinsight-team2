"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import {
  activeAlerts,
  attendAlert,
  changesSinceLastVisit,
  dismissAlert,
  mergeShiftAlerts,
  newSinceVisit,
} from "@/lib/domain/alerts"
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
  totalNuevosDesdeVisita: number
  esPrimeraVisita: boolean
  ultimoLogoutTs: number | null
  ultimaActualizacion: number | null
  ingresar: (usuario: Usuario) => void
  salir: () => void
  marcarAtendida: (id: string) => void
  marcarNoAplica: (id: string) => void
  simularCambioTurno: () => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>(() => ordenarAlertas(ALERTAS_INICIALES))
  // Ids marcados como "nuevos" al ingresar o al simular un cambio de turno
  // (F1): NO es la lista final a mostrar. `cambiosDesdeUltimaVisita` se
  // deriva de esto filtrando contra las alertas activas actuales, así que
  // un id sigue en `nuevosIds` incluso después de atender/marcar no aplica
  // esa alerta, pero desaparece del resultado visible automáticamente.
  const [nuevosIds, setNuevosIds] = useState<string[]>([])
  const [esPrimeraVisita, setEsPrimeraVisita] = useState(true)
  const [ultimoLogoutTs, setUltimoLogoutTs] = useState<number | null>(null)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<number | null>(null)

  // Baseline por usuario: ids vistos y hora de su último cierre de sesión.
  // No se persiste entre recargas de página (estado en memoria del cliente).
  const vistoPorUsuario = useRef<Record<string, string[]>>({})
  const logoutPorUsuario = useRef<Record<string, number>>({})

  const alertasActivas = useMemo(() => activeAlerts(alertas), [alertas])
  const nuevosIdsSet = useMemo(() => new Set(nuevosIds), [nuevosIds])
  const cambiosDesdeUltimaVisita = useMemo(
    () => newSinceVisit(alertasActivas, nuevosIdsSet),
    [alertasActivas, nuevosIdsSet],
  )

  const ingresar = useCallback(
    (u: Usuario) => {
      const vistoAntes = vistoPorUsuario.current[u.id]
      const primeraVisita = vistoAntes === undefined
      setNuevosIds(changesSinceLastVisit(alertas, vistoAntes).map((a) => a.id))
      setEsPrimeraVisita(primeraVisita)
      setUltimoLogoutTs(primeraVisita ? null : (logoutPorUsuario.current[u.id] ?? null))
      setUltimaActualizacion(Date.now())
      setUsuario(u)
    },
    [alertas],
  )

  const salir = useCallback(() => {
    if (usuario) {
      vistoPorUsuario.current[usuario.id] = alertasActivas.map((a) => a.id)
      logoutPorUsuario.current[usuario.id] = Date.now()
    }
    setUsuario(null)
    setNuevosIds([])
  }, [usuario, alertasActivas])

  const marcarAtendida = useCallback((id: string) => {
    setAlertas((prev) => attendAlert(prev, id))
  }, [])

  const marcarNoAplica = useCallback((id: string) => {
    setAlertas((prev) => dismissAlert(prev, id))
  }, [])

  const simularCambioTurno = useCallback(() => {
    const { alerts, added } = mergeShiftAlerts(alertas, ALERTAS_NUEVO_TURNO, Date.now())
    if (added.length > 0) {
      setNuevosIds((prev) => [...prev, ...added.map((a) => a.id)])
    }
    setUltimaActualizacion(Date.now())
    setAlertas(alerts)
  }, [alertas])

  const value: AppState = {
    usuario,
    alertas,
    alertasActivas,
    cambiosDesdeUltimaVisita,
    totalNuevosDesdeVisita: nuevosIds.length,
    esPrimeraVisita,
    ultimoLogoutTs,
    ultimaActualizacion,
    ingresar,
    salir,
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
