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
} from "@/lib/oficina/push-toggle-logic"

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
      const registro = await navigator.serviceWorker.register("/sw.js")
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
