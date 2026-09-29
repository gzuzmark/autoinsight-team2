"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import { createPoller } from "@/lib/api/poller"
import { haceCuanto } from "@/lib/mock-data"
import type { NotificacionAlerta } from "@/lib/domain/floor-repository"
import {
  contarNoLeidas,
  esNoLeida,
  etiquetaContador,
  guardarIdsLeidos,
  leerIdsLeidos,
  marcarLeida,
  marcarTodasLeidas,
} from "@/lib/oficina/notificaciones"
import { eventoOficinaCampanaAbierta, eventoOficinaNotificacionClick } from "@/lib/analytics/events"
import { capturarEvento } from "@/lib/analytics/posthog-client"
import { obtenerIdParticipanteOficina } from "@/lib/oficina/participante-cliente"

const PANEL_ID = "oficina-notificaciones-panel"

/**
 * G9: office header notification bell (YouTube-style). No auth on /oficina
 * (O-D4, same as PushToggle) -- lists recent ALTA alerts from
 * GET /api/oficina/notificaciones. Read state is per browser (localStorage,
 * lib/oficina/notificaciones.ts), never sent to the server.
 *
 * Refresh: polls every 15s while the tab is visible (mirrors the floor's
 * D29 pattern via the same lib/api/poller.ts), and refetches immediately
 * when the service worker posts a message on receiving a push
 * (public/sw.js's `push` handler -> every open client).
 */
export function NotificationBell() {
  const [abierto, setAbierto] = useState(false)
  const [notificaciones, setNotificaciones] = useState<NotificacionAlerta[]>([])
  const [idsLeidos, setIdsLeidos] = useState<ReadonlySet<string>>(() => new Set())
  const contenedorRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIdsLeidos(leerIdsLeidos())
  }, [])

  const refrescar = useCallback(async () => {
    try {
      const res = await fetch("/api/oficina/notificaciones", { cache: "no-store" })
      if (!res.ok) return
      const body = (await res.json()) as { notificaciones?: unknown }
      if (Array.isArray(body.notificaciones)) setNotificaciones(body.notificaciones as NotificacionAlerta[])
    } catch {
      // Best-effort: the bell keeps showing the last good list, same
      // degrade-quietly approach as the floor's tablero poll.
    }
  }, [])

  useEffect(() => {
    void refrescar()

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

    // G9: public/sw.js's `push` handler posts { type: "push-recibido" } to
    // every open client right after showNotification -- refetch instead of
    // waiting up to 15s for the next scheduled poll.
    function onMessage(event: MessageEvent) {
      if (event.data && typeof event.data === "object" && event.data.type === "push-recibido") {
        poller.notifyVisible()
      }
    }
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onMessage)
    }

    return () => {
      poller.stop()
      document.removeEventListener("visibilitychange", onVisibilityChange)
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onMessage)
      }
    }
  }, [refrescar])

  // Escape closes (focus returns to the trigger) and a click outside the
  // bell+panel closes it too -- only wired while open.
  useEffect(() => {
    if (!abierto) return
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        setAbierto(false)
        botonRef.current?.focus()
      }
    }
    function onPointerDown(ev: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(ev.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("mousedown", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("mousedown", onPointerDown)
    }
  }, [abierto])

  useEffect(() => {
    if (abierto) panelRef.current?.focus()
  }, [abierto])

  function alternar() {
    setAbierto((previo) => {
      const proximo = !previo
      if (proximo) {
        obtenerIdParticipanteOficina().then((participante) => {
          capturarEvento(eventoOficinaCampanaAbierta({ participante, vista: "oficina" }))
        })
      }
      return proximo
    })
  }

  function alHacerClicNotificacion(notificacion: NotificacionAlerta) {
    setIdsLeidos((previo) => {
      const siguiente = marcarLeida(previo, notificacion.id)
      guardarIdsLeidos(siguiente)
      return siguiente
    })
    obtenerIdParticipanteOficina().then((participante) => {
      capturarEvento(
        eventoOficinaNotificacionClick({ participante, vista: "oficina" }, { alertaId: notificacion.id }),
      )
    })
    setAbierto(false)
  }

  function marcarTodas() {
    setIdsLeidos((previo) => {
      const siguiente = marcarTodasLeidas(notificaciones, previo)
      guardarIdsLeidos(siguiente)
      return siguiente
    })
  }

  const noLeidas = contarNoLeidas(notificaciones, idsLeidos)
  const etiqueta = etiquetaContador(noLeidas)

  return (
    <div ref={contenedorRef} className="relative">
      <button
        ref={botonRef}
        type="button"
        data-testid="notification-bell"
        onClick={alternar}
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-controls={PANEL_ID}
        aria-label={etiqueta ? `Notificaciones, ${noLeidas} sin leer` : "Notificaciones"}
        className="relative flex size-7 items-center justify-center rounded-md border border-border text-neutral-700 hover:bg-neutral-100"
      >
        <Bell className="size-4" aria-hidden />
        {etiqueta && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold leading-none text-white"
          >
            {etiqueta}
          </span>
        )}
      </button>

      {abierto && (
        <div
          id={PANEL_ID}
          ref={panelRef}
          tabIndex={-1}
          role="region"
          aria-label="Notificaciones"
          data-testid="notification-bell-panel"
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-md border border-border bg-white shadow-lg outline-none"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Notificaciones</span>
            <button
              type="button"
              onClick={marcarTodas}
              disabled={noLeidas === 0}
              className="text-xs font-medium text-indigo-700 hover:underline disabled:pointer-events-none disabled:text-neutral-400"
            >
              Marcar todas como leídas
            </button>
          </div>

          {notificaciones.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Sin notificaciones</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notificaciones.map((notificacion) => (
                <li key={notificacion.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={`/oficina/alertas/${notificacion.id}`}
                    onClick={() => alHacerClicNotificacion(notificacion)}
                    className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-neutral-50"
                  >
                    <span
                      aria-hidden
                      className={
                        esNoLeida(notificacion, idsLeidos)
                          ? "mt-1.5 size-2 shrink-0 rounded-full bg-indigo-600"
                          : "mt-1.5 size-2 shrink-0 rounded-full bg-transparent"
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-neutral-900">{notificacion.titulo}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {notificacion.linea}
                        {notificacion.estacion ? ` · ${notificacion.estacion}` : ""}
                      </span>
                      <span className="block text-xs text-muted-foreground">{haceCuanto(notificacion.creadaEn)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
