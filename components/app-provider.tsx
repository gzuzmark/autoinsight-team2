"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { api, ApiError, type LoginResult } from "@/lib/api/client"
import { createPoller } from "@/lib/api/poller"
import { derivarVista } from "@/lib/domain/tablero-view"
import {
  descartarPendientes,
  ESTADO_INICIAL_NUEVAS_ALERTAS,
  registrarPoll,
  type EstadoNuevasAlertas,
} from "@/lib/domain/nuevas-alertas-poll"
import {
  ESTADO_INICIAL_ULTIMA_ACTUALIZACION,
  registrarPollExitoso,
  type EstadoUltimaActualizacion,
} from "@/lib/domain/ultima-actualizacion-poll"
import type { IndicadorTablero, Linea, Planta, Tablero, UsuarioLogin } from "@/lib/domain/floor-repository"
import type { Alerta } from "@/lib/mock-data"
import {
  ESTADO_INICIAL_TIMING,
  msDesdeAbierta,
  msDesdeMostrada,
  registrarAbierta,
  registrarMostradas,
  type EstadoTimingAlertas,
} from "@/lib/analytics/alerta-timing"
import { eventoAlertaAbierta, eventoAlertaMostrada, eventoAlertaResuelta, eventoLogin, eventoNuevasAlertasVistas } from "@/lib/analytics/events"
import { participanteIdParaIdentificar } from "@/lib/analytics/identify-on-change"
import { capturarEvento, identificarParticipante, reiniciarIdentidad } from "@/lib/analytics/posthog-client"

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
  /** Batch I: epoch ms of the last SUCCESSFUL poll of /api/tablero this
   * session (D6/D29 "Última actualización HH:MM"), null before the first
   * one lands -- NOT Tablero#ultimaActualizacion (the DB's own last-data-
   * change timestamp). */
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
  /** G8: call when the alert detail panel opens (components/dashboard.tsx's
   * `abrir`) -- records the open time and fires `eventoAlertaAbierta`. */
  registrarAperturaAlerta: (id: string) => void
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
  // Batch I: same "every successful tablero fetch" centralization as
  // nuevasAlertasEstado above, tracking when (not what) last landed --
  // see lib/domain/ultima-actualizacion-poll.ts's doc for why this is the
  // DB's `ultima_actualizacion`.
  const [ultimaActualizacionEstado, setUltimaActualizacionEstado] = useState<EstadoUltimaActualizacion>(
    ESTADO_INICIAL_ULTIMA_ACTUALIZACION,
  )

  // G8: session-scoped analytics state -- refs (not useState) because
  // nothing here needs to trigger a re-render on its own; it only feeds
  // side-effecting PostHog calls made from aplicarTablero/marcarAtendida/
  // marcarNoAplica/registrarAperturaAlerta/descartarNuevasAlertasPoll
  // below. Reset on logout (salir) so a new session starts clean.
  const timingRef = useRef<EstadoTimingAlertas>(ESTADO_INICIAL_TIMING)
  const participanteIdRef = useRef<string | null>(null)

  // G7a: every successful tablero fetch (login, poll tick, or a
  // resolve-triggered refresh) feeds the pure new-alerts-since-poll
  // reducer. Centralized here so the poller/marcarAtendida/marcarNoAplica
  // below don't each have to remember to call it.
  //
  // G8: also feeds the alert-timing tracker (fires `alerta_mostrada` for
  // any alert id seen for the first time this session) and re-identifies
  // the PostHog participant whenever the tablero's own participant number
  // changes (participanteIdParaIdentificar -- lib/analytics/identify-on-change.ts).
  const aplicarTablero = useCallback((t: Tablero) => {
    setTablero(t)
    setNuevasAlertasEstado((prev) => registrarPoll(prev, t.alertas))
    setUltimaActualizacionEstado((prev) => registrarPollExitoso(prev, Date.now()))

    const ahora = Date.now()
    const { estado: nuevoTiming, nuevas } = registrarMostradas(
      timingRef.current,
      t.alertas.map((a) => a.id),
      ahora,
    )
    timingRef.current = nuevoTiming

    const nuevoParticipanteId = participanteIdParaIdentificar(participanteIdRef.current, t.participante)
    if (nuevoParticipanteId) {
      participanteIdRef.current = nuevoParticipanteId
      identificarParticipante(nuevoParticipanteId, { usuario: t.usuario.nombre, linea: t.linea.nombre })
    }

    if (participanteIdRef.current) {
      const base = { participante: participanteIdRef.current, vista: "planta" as const }
      t.alertas.forEach((a, posicion) => {
        if (!nuevas.includes(a.id)) return
        capturarEvento(eventoAlertaMostrada(base, { alertaId: a.id, severidad: a.severidad, linea: t.linea.nombre, posicion }))
      })
    }
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

  const ingresar = useCallback(
    async (usuarioId: string, pin: string): Promise<LoginResult> => {
      const resultado = await api.login(usuarioId, pin)
      if (resultado.ok) {
        const t = await api.tablero()
        aplicarTablero(t)
        setTableroError(null)
        // G8: fired after aplicarTablero so the participant is already
        // identified (participanteIdRef.current is set) by the time this
        // event is captured.
        if (participanteIdRef.current) {
          capturarEvento(
            eventoLogin({ participante: participanteIdRef.current, vista: "planta" }, { linea: t.linea.nombre }),
          )
        }
      }
      return resultado
    },
    [aplicarTablero],
  )

  const salir = useCallback(() => {
    setTablero(null)
    setTableroError(null)
    // G7a: a new session (next login) must start with a clean baseline --
    // no leftover "new alerts" from the previous user's session.
    setNuevasAlertasEstado(ESTADO_INICIAL_NUEVAS_ALERTAS)
    // Batch I (D29 "stops on logout"): the header itself disappears once
    // tablero is null, but reset the timestamp too so a later session
    // never renders a stale "Última actualización" from before this logout.
    setUltimaActualizacionEstado(ESTADO_INICIAL_ULTIMA_ACTUALIZACION)
    // G8: a new session (next login, possibly a different participant)
    // must start with a clean PostHog identity and a clean timing state --
    // never attribute the next session's events to this one.
    timingRef.current = ESTADO_INICIAL_TIMING
    participanteIdRef.current = null
    reiniciarIdentidad()
    void api.logout()
  }, [])

  const marcarAtendida = useCallback(
    (id: string) => {
      capturarResolucion("atendida", id)
      api.resolver(id, "atendida").then(aplicarTablero, () => setTableroError("No se pudo actualizar la alerta."))
    },
    [aplicarTablero],
  )

  const marcarNoAplica = useCallback(
    (id: string) => {
      capturarResolucion("no_aplica", id)
      api.resolver(id, "no_aplica").then(aplicarTablero, () => setTableroError("No se pudo actualizar la alerta."))
    },
    [aplicarTablero],
  )

  // G8: shared by marcarAtendida/marcarNoAplica above -- reads the timing
  // state BEFORE the resolve request (this call's own "now") so
  // ms_desde_abierta/ms_desde_mostrada reflect when the facilitator/user
  // actually made the decision, not when the resolve request settles.
  function capturarResolucion(resolucion: "atendida" | "no_aplica", id: string) {
    if (!participanteIdRef.current) return
    const ahora = Date.now()
    const base = { participante: participanteIdRef.current, vista: "planta" as const }
    capturarEvento(
      eventoAlertaResuelta(resolucion, base, {
        alertaId: id,
        msDesdeAbierta: msDesdeAbierta(timingRef.current, id, ahora),
        msDesdeMostrada: msDesdeMostrada(timingRef.current, id, ahora),
      }),
    )
  }

  const registrarAperturaAlerta = useCallback((id: string) => {
    const ahora = Date.now()
    timingRef.current = registrarAbierta(timingRef.current, id, ahora)
    if (!participanteIdRef.current) return
    capturarEvento(
      eventoAlertaAbierta(
        { participante: participanteIdRef.current, vista: "planta" },
        { alertaId: id, msDesdeMostrada: msDesdeMostrada(timingRef.current, id, ahora) },
      ),
    )
  }, [])

  const descartarNuevasAlertasPoll = useCallback(() => {
    setNuevasAlertasEstado((prev) => {
      // G8: capture BEFORE clearing -- prev.pendientes is what is about to
      // be discarded, an empty dismissal is a no-op event that would tell
      // the facilitator nothing.
      if (prev.pendientes.length > 0 && participanteIdRef.current) {
        capturarEvento(
          eventoNuevasAlertasVistas(
            { participante: participanteIdRef.current, vista: "planta" },
            { cantidad: prev.pendientes.length },
          ),
        )
      }
      return descartarPendientes(prev)
    })
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
            setUltimaActualizacionEstado(ESTADO_INICIAL_ULTIMA_ACTUALIZACION)
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
    // Batch I: last SUCCESSFUL poll of /api/tablero, not the DB's own
    // ultima_actualizacion (see lib/domain/ultima-actualizacion-poll.ts).
    ultimaActualizacion: ultimaActualizacionEstado.ultimoPollExitoso,
    tableroError,
    nuevasAlertasPoll: [...nuevasAlertasEstado.pendientes],
    descartarNuevasAlertasPoll,
    ingresar,
    salir,
    marcarAtendida,
    marcarNoAplica,
    registrarAperturaAlerta,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider")
  return ctx
}
