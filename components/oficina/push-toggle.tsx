"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ETIQUETA_ESTADO, estadoInicial, urlBase64ToUint8Array, type EstadoNotificaciones } from "@/lib/oficina/push-support"
import {
  estadoTrasResincronizar,
  extraerMensajeError,
  mensajeErrorActivar,
  mensajeErrorDesactivar,
  mensajeErrorServiceWorker,
} from "@/lib/oficina/push-toggle-logic"
import { eventoPushCambiado } from "@/lib/analytics/events"
import { capturarEvento } from "@/lib/analytics/posthog-client"
import { obtenerIdParticipanteOficina } from "@/lib/oficina/participante-cliente"
import { conLimite } from "@/lib/push/with-timeout"

const LIMITE_SERVICE_WORKER_LISTO_MS = 10_000

// G8: fires push_activado/push_desactivado only on a real state change the
// user caused (never on the on-load re-sync, which can also land on
// "activadas" without any click -- see the useEffect below).
function capturarCambioPush(activo: boolean) {
  obtenerIdParticipanteOficina().then((participante) => {
    capturarEvento(eventoPushCambiado({ participante, vista: "oficina" }, activo))
  })
}

/**
 * G7b: office "Activar notificaciones" button (D-less -- no auth on
 * /oficina, see the README's own note on this). Permission is requested
 * only on click, never on load, per the brief. States: no-soportado
 * (SSR-safe initial render, resolved to the real browser state in
 * useEffect) / bloqueadas / inactivo / activadas / activando / desactivando
 * / error.
 *
 * I-3 (RDD review G7b follow-up, 2026-09-29): the estado transitions and
 * error wording live in lib/oficina/push-toggle-logic.ts (pure, unit
 * tested) -- this component only does the browser/fetch I/O and calls
 * those helpers to decide what to show.
 */
export function PushToggle() {
  const [estado, setEstado] = useState<EstadoNotificaciones>("no-soportado")
  const [mensajeError, setMensajeError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    async function resolver() {
      const soportado =
        typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
      if (!soportado) {
        setEstado("no-soportado")
        return
      }
      try {
        const registro = await navigator.serviceWorker.register("/sw.js")
        const suscripcion = await registro.pushManager.getSubscription()
        if (cancelado) return
        if (!suscripcion) {
          setEstado(estadoInicial(true, Notification.permission))
          return
        }
        // I-3: the browser already has a subscription, but the server row
        // may not (cleared by an admin, or a previous "Activar" whose
        // browser subscribe succeeded but server POST failed) -- re-sync it
        // as an upsert instead of trusting the browser state alone. Only
        // "activadas" when the server actually accepts it.
        const json = suscripcion.toJSON()
        const res = await fetch("/api/oficina/push/suscripcion", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        })
        if (cancelado) return
        const { estado: nuevoEstado, mensaje } = estadoTrasResincronizar(res.ok)
        setEstado(nuevoEstado)
        setMensajeError(mensaje)
      } catch {
        if (!cancelado) setEstado(estadoInicial(true, Notification.permission))
      }
    }
    resolver()
    return () => {
      cancelado = true
    }
  }, [])

  async function activar() {
    setEstado("activando")
    setMensajeError(null)
    let suscripcion: PushSubscription | null = null
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueadas" : "inactivo")
        return
      }
      const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!clavePublica) {
        setEstado("error")
        return
      }
      // Push fix (a): wait for BOTH register() to resolve AND
      // navigator.serviceWorker.ready before subscribing -- register()
      // alone can resolve to a registration whose worker is still
      // installing/activating (observed in Zen: subscribe() then failed
      // silently, no server request at all). `ready`'s registration is the
      // one guaranteed to have an active worker.
      //
      // L-3: `ready` itself never rejects on its own -- a worker that never
      // reaches "activated" (a broken sw.js, a browser bug, a stuck install)
      // left this hanging on "Activando..." forever, with no way out short
      // of reloading. `conLimite` bounds it; a timeout is treated the same
      // as any other failure to become ready.
      let registro: ServiceWorkerRegistration
      try {
        await navigator.serviceWorker.register("/sw.js")
        registro = await conLimite(
          navigator.serviceWorker.ready,
          LIMITE_SERVICE_WORKER_LISTO_MS,
          "Service worker: tiempo de espera agotado.",
        )
      } catch {
        setEstado("error")
        setMensajeError(mensajeErrorServiceWorker())
        return
      }
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(clavePublica),
      })
      const json = suscripcion.toJSON()
      const res = await fetch("/api/oficina/push/suscripcion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      if (res.ok) {
        setEstado("activadas")
        capturarCambioPush(true)
        return
      }
      // I-3: the server does not have this subscription -- unsubscribe the
      // browser too, instead of leaving it orphaned (the previous bug: the
      // next page load would see a live browser subscription and show
      // "Activadas" with no matching server row).
      const cuerpo = await res
        .json()
        .catch(() => null)
      await suscripcion.unsubscribe().catch(() => {})
      setEstado("error")
      setMensajeError(mensajeErrorActivar(res.status, extraerMensajeError(cuerpo)))
    } catch {
      await suscripcion?.unsubscribe().catch(() => {})
      setEstado("error")
    }
  }

  async function desactivar() {
    setEstado("desactivando")
    setMensajeError(null)
    try {
      const registro = await navigator.serviceWorker.register("/sw.js")
      const suscripcion = await registro.pushManager.getSubscription()
      if (suscripcion) {
        const endpoint = suscripcion.endpoint
        // I-3: unsubscribe locally regardless of what the server says (the
        // browser subscription must not outlive the user's "Desactivar"
        // click either way) -- but check the DELETE response instead of
        // ignoring it, and surface a server-side failure.
        await suscripcion.unsubscribe()
        const res = await fetch("/api/oficina/push/suscripcion", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint }),
        })
        if (!res.ok) {
          const cuerpo = await res.json().catch(() => null)
          setMensajeError(mensajeErrorDesactivar(extraerMensajeError(cuerpo)))
        }
        capturarCambioPush(false)
      }
      setEstado("inactivo")
    } catch {
      setEstado("error")
    }
  }

  if (estado === "no-soportado" || estado === "bloqueadas") {
    return (
      <span
        data-testid="push-toggle"
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-neutral-500"
      >
        <BellOff className="size-4" aria-hidden />
        {ETIQUETA_ESTADO[estado]}
      </span>
    )
  }

  if (estado === "activadas") {
    return (
      <Button data-testid="push-toggle" variant="outline" size="sm" onClick={desactivar} className="gap-1.5">
        <Bell className="size-4" aria-hidden />
        Desactivar
      </Button>
    )
  }

  return (
    <>
      <Button
        data-testid="push-toggle"
        variant="outline"
        size="sm"
        onClick={activar}
        disabled={estado === "activando" || estado === "desactivando"}
        className="gap-1.5"
      >
        <Bell className="size-4" aria-hidden />
        {ETIQUETA_ESTADO[estado]}
      </Button>
      {mensajeError && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {mensajeError}
        </p>
      )}
    </>
  )
}
