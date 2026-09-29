import type { LineaDemoConocida } from "@/lib/domain/floor-repository"
import type { Alerta } from "@/lib/mock-data"
import type { PushPayload } from "@/lib/push/sender"

/**
 * G7b: builds one notification payload per new ALTA alert (the trigger
 * only ever fans this out for `severidad === "parar"` -- see
 * lib/push/notify.ts) -- pure so it is unit-testable without a repository
 * or a real service worker.
 */
export function construirPayloadAlerta(linea: LineaDemoConocida, alerta: Alerta): PushPayload {
  return {
    title: `Alerta ALTA · ${linea}`,
    body: `${alerta.titulo} · ${alerta.estacion || "Estación sin especificar"}`,
    tag: `alerta-${alerta.id}`,
    // G8: the query flag lets the office page tell "opened from a push
    // click" apart from "opened from the Resumen table" (notificacion_click
    // + oficina_alerta_abierta's `origen`, lib/analytics/events.ts) --
    // public/sw.js's notificationclick handler passes this url through
    // verbatim (see lib/push/sw-helpers.ts#urlDeNotificacion).
    url: `/oficina/alertas/${alerta.id}?origen=push`,
  }
}
