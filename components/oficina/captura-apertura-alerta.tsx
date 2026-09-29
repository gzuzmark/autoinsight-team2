"use client"

import { useEffect } from "react"
import { eventoNotificacionClick, eventoOficinaAlertaAbierta } from "@/lib/analytics/events"
import { capturarEvento } from "@/lib/analytics/posthog-client"
import { obtenerIdParticipanteOficina } from "@/lib/oficina/participante-cliente"

/**
 * G8: mounted once by app/oficina/alertas/[id]/page.tsx (a Server
 * Component, so this small client island is where `oficina_alerta_abierta`
 * -- and, when opened from a push click, `notificacion_click` too -- can
 * actually fire). `origenPush` is true when the URL carries `?origen=push`
 * (set server-side by lib/push/payload.ts, delivered by
 * public/sw.js's notificationclick handler).
 */
export function CapturaAperturaAlerta({ alertaId, origenPush }: { alertaId: string; origenPush: boolean }) {
  useEffect(() => {
    let cancelado = false
    obtenerIdParticipanteOficina().then((participante) => {
      if (cancelado) return
      const base = { participante, vista: "oficina" as const }
      if (origenPush) {
        capturarEvento(eventoNotificacionClick(base, { alertaId }))
      }
      capturarEvento(eventoOficinaAlertaAbierta(base, { alertaId, origen: origenPush ? "push" : "tabla" }))
    })
    return () => {
      cancelado = true
    }
    // Fires once per mount (one alert id per page load) -- alertaId/origenPush
    // are stable for the lifetime of this Server Component's render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
