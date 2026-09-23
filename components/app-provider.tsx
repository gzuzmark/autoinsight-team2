"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import {
  ALERTAS_INICIALES,
  ALERTAS_NUEVO_TURNO,
  INDICADORES,
  ordenarAlertas,
  type Alerta,
  type Feedback,
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
  registrarPrimerToque: () => void
  darFeedback: (id: string, feedback: Exclude<Feedback, null>) => void
  marcarAtendida: (id: string) => void
  simularCambioTurno: () => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>(() => ordenarAlertas(ALERTAS_INICIALES))
  const [cambiosDesdeUltimaVisita, setCambios] = useState<Alerta[]>([])
  const [mostrarUltimaVisita, setMostrarUltimaVisita] = useState(false)

  // Medición (solo para la prueba). No se persiste.
  const ingresoTs = useRef<number>(0)
  const primerToqueHecho = useRef(false)
  const sesionesPorUsuario = useRef<Record<string, number>>({})
  const vistoPorUsuario = useRef<Record<string, string[]>>({})

  const alertasActivas = useMemo(
    () => ordenarAlertas(alertas.filter((a) => a.estado === "nueva")),
    [alertas],
  )

  const ingresar = useCallback((u: Usuario) => {
    const sesiones = (sesionesPorUsuario.current[u.id] ?? 0) + 1
    sesionesPorUsuario.current[u.id] = sesiones
    ingresoTs.current = Date.now()
    primerToqueHecho.current = false

    console.log(`[v0] Ingreso de ${u.nombre} (${u.id}) · sesión #${sesiones} de hoy`)

    // ¿Qué cambió desde la última visita de este usuario?
    const vistoAntes = vistoPorUsuario.current[u.id]
    setAlertas((prev) => {
      const activas = prev.filter((a) => a.estado === "nueva")
      if (vistoAntes) {
        const nuevas = activas.filter((a) => !vistoAntes.includes(a.id))
        if (nuevas.length > 0) {
          setCambios(ordenarAlertas(nuevas))
          setMostrarUltimaVisita(true)
        }
      }
      return prev
    })

    setUsuario(u)
  }, [])

  const salir = useCallback(() => {
    setUsuario((u) => {
      if (u) {
        vistoPorUsuario.current[u.id] = alertasActivas.map((a) => a.id)
      }
      return null
    })
    setMostrarUltimaVisita(false)
    setCambios([])
  }, [alertasActivas])

  const cerrarUltimaVisita = useCallback(() => {
    setMostrarUltimaVisita(false)
    ingresoTs.current = Date.now()
  }, [])

  const registrarPrimerToque = useCallback(() => {
    if (primerToqueHecho.current || !usuario) return
    primerToqueHecho.current = true
    const segundos = ((Date.now() - ingresoTs.current) / 1000).toFixed(1)
    console.log(
      `[v0] ${usuario.nombre}: primer toque en una alerta a los ${segundos} s desde el ingreso`,
    )
  }, [usuario])

  const darFeedback = useCallback((id: string, feedback: Exclude<Feedback, null>) => {
    setAlertas((prev) => prev.map((a) => (a.id === id ? { ...a, feedback } : a)))
    console.log(`[v0] Feedback "${feedback}" en alerta ${id}`)
  }, [])

  const marcarAtendida = useCallback((id: string) => {
    setAlertas((prev) => prev.map((a) => (a.id === id ? { ...a, estado: "atendida" } : a)))
    console.log(`[v0] Alerta ${id} marcada como atendida`)
  }, [])

  const simularCambioTurno = useCallback(() => {
    setAlertas((prev) => {
      const existentes = new Set(prev.map((a) => a.id))
      const entrantes = ALERTAS_NUEVO_TURNO.filter((a) => !existentes.has(a.id)).map((a) => ({
        ...a,
        timestamp: Date.now(),
      }))
      if (entrantes.length > 0) {
        setCambios(ordenarAlertas(entrantes))
        setMostrarUltimaVisita(true)
      }
      return ordenarAlertas([...prev, ...entrantes])
    })
    console.log("[v0] Simulación: cambio de turno (alertas agregadas y reordenadas)")
  }, [])

  const value: AppState = {
    usuario,
    alertas,
    alertasActivas,
    cambiosDesdeUltimaVisita,
    mostrarUltimaVisita,
    ingresar,
    salir,
    cerrarUltimaVisita,
    registrarPrimerToque,
    darFeedback,
    marcarAtendida,
    simularCambioTurno,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider")
  return ctx
}
