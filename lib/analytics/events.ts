import type { Severidad } from "@/lib/mock-data"

/**
 * G8: pure PostHog event payload builders. Every event carries `participante`
 * (the "P<n>" identify id, Tablero#participante / EstadoDemo#participanteActual)
 * and `vista` ("planta" | "oficina") -- kept out of
 * lib/analytics/posthog-client.ts so the builders are trivially unit
 * testable with no browser/posthog-js dependency, and so no call site can
 * silently omit a base field.
 */

export type Vista = "planta" | "oficina"

export type EventoBase = {
  /** "P<n>" -- the same id posthog.identify() is called with. */
  participante: string
  vista: Vista
}

export type EventoAnalitica = { name: string; properties: Record<string, unknown> }

function evento(name: string, base: EventoBase, extra: Record<string, unknown>): EventoAnalitica {
  return { name, properties: { participante: base.participante, vista: base.vista, ...extra } }
}

/** First time an alert id becomes visible on the floor in this session
 * (D9's poll-driven strip and the initial tablero fetch both count --
 * lib/analytics/alerta-timing.ts decides "first time", this only builds
 * the payload). */
export function eventoAlertaMostrada(
  base: EventoBase,
  datos: { alertaId: string; severidad: Severidad; linea: string; posicion: number },
): EventoAnalitica {
  return evento("alerta_mostrada", base, {
    alerta_id: datos.alertaId,
    severidad: datos.severidad,
    linea: datos.linea,
    posicion: datos.posicion,
  })
}

/** The alert's detail panel was opened. `msDesdeMostrada` is null when the
 * alert was opened before `eventoAlertaMostrada`'s timing state ever
 * recorded it being shown (should not normally happen -- every alert in
 * `alertasActivas` was shown by the same tablero fetch that made it
 * openable -- kept nullable defensively rather than fabricating a 0). */
export function eventoAlertaAbierta(
  base: EventoBase,
  datos: { alertaId: string; msDesdeMostrada: number | null },
): EventoAnalitica {
  return evento("alerta_abierta", base, {
    alerta_id: datos.alertaId,
    ms_desde_mostrada: datos.msDesdeMostrada,
  })
}

export type ResolucionEvento = "atendida" | "no_aplica"

/** "Atendida"/"No aplica" from the detail panel -- `alerta_atendida` or
 * `alerta_no_aplica` depending on `resolucion`. */
export function eventoAlertaResuelta(
  resolucion: ResolucionEvento,
  base: EventoBase,
  datos: { alertaId: string; msDesdeAbierta: number | null; msDesdeMostrada: number | null },
): EventoAnalitica {
  return evento(resolucion === "atendida" ? "alerta_atendida" : "alerta_no_aplica", base, {
    alerta_id: datos.alertaId,
    ms_desde_abierta: datos.msDesdeAbierta,
    ms_desde_mostrada: datos.msDesdeMostrada,
  })
}

/** G7a's "N alertas nuevas · HH:MM" strip was dismissed. */
export function eventoNuevasAlertasVistas(base: EventoBase, datos: { cantidad: number }): EventoAnalitica {
  return evento("nuevas_alertas_vistas", base, { cantidad: datos.cantidad })
}

export function eventoLogin(base: EventoBase, datos: { linea: string }): EventoAnalitica {
  return evento("login", base, { linea: datos.linea })
}

export type OrigenAperturaOficina = "push" | "tabla"

/** The office alert-investigation screen was opened, either from the
 * Resumen table or from a push-notification click (`?origen=push`, see
 * app/oficina/alertas/[id]/page.tsx). */
export function eventoOficinaAlertaAbierta(
  base: EventoBase,
  datos: { alertaId: string; origen?: OrigenAperturaOficina },
): EventoAnalitica {
  return evento("oficina_alerta_abierta", base, {
    alerta_id: datos.alertaId,
    origen: datos.origen ?? "tabla",
  })
}

/** "Activar notificaciones" toggled (components/oficina/push-toggle.tsx). */
export function eventoPushCambiado(base: EventoBase, activo: boolean): EventoAnalitica {
  return evento(activo ? "push_activado" : "push_desactivado", base, {})
}

/** A browser push notification was clicked (service worker `postMessage`
 * -> the office page captures this once mounted with `?origen=push`). */
export function eventoNotificacionClick(base: EventoBase, datos: { alertaId: string }): EventoAnalitica {
  return evento("notificacion_click", base, { alerta_id: datos.alertaId })
}

/** G9: the office notification bell dropdown was opened. */
export function eventoOficinaCampanaAbierta(base: EventoBase): EventoAnalitica {
  return evento("oficina_campana_abierta", base, {})
}

/** G9: a notification was clicked inside the bell dropdown. `desde` is
 * always "campana" here (the bell is the only source of this event) --
 * kept as an explicit field, matching the brief, rather than a hardcoded
 * assumption at every call site. */
export function eventoOficinaNotificacionClick(base: EventoBase, datos: { alertaId: string }): EventoAnalitica {
  return evento("oficina_notificacion_click", base, { alerta_id: datos.alertaId, desde: "campana" })
}
