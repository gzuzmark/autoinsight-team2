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
    url: `/oficina/alertas/${alerta.id}`,
  }
}
