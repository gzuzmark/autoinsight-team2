"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ETIQUETA_ESTADO, estadoInicial, urlBase64ToUint8Array, type EstadoNotificaciones } from "@/lib/oficina/push-support"

/**
 * G7b: office "Activar notificaciones" button (D-less -- no auth on
 * /oficina, see the README's own note on this). Permission is requested
 * only on click, never on load, per the brief. States: no-soportado
 * (SSR-safe initial render, resolved to the real browser state in
 * useEffect) / bloqueadas / inactivo / activadas / activando / desactivando
 * / error.
 */
export function PushToggle() {
  const [estado, setEstado] = useState<EstadoNotificaciones>("no-soportado")

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
        setEstado(suscripcion ? "activadas" : estadoInicial(true, Notification.permission))
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
      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(clavePublica),
      })
      const json = suscripcion.toJSON()
      const res = await fetch("/api/oficina/push/suscripcion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      if (!res.ok) {
        setEstado("error")
        return
      }
      setEstado("activadas")
    } catch {
      setEstado("error")
    }
  }

  async function desactivar() {
    setEstado("desactivando")
    try {
      const registro = await navigator.serviceWorker.register("/sw.js")
      const suscripcion = await registro.pushManager.getSubscription()
      if (suscripcion) {
        const endpoint = suscripcion.endpoint
        await suscripcion.unsubscribe()
        await fetch("/api/oficina/push/suscripcion", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint }),
        })
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
  )
}
