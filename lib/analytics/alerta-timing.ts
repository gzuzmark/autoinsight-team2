/**
 * G8: pure, session-scoped alert-timing tracker feeding the PostHog
 * ms_desde_mostrada/ms_desde_abierta fields (lib/analytics/events.ts).
 * Explicit state-in/state-out (no class, no hidden mutation), same shape as
 * lib/domain/nuevas-alertas-poll.ts -- components/app-provider.tsx holds
 * the state and calls these on every tablero fetch / alert open.
 *
 * "Shown" here means "the client actually rendered it" (first time an
 * alert id appears in a fetched tablero this session), independent of
 * D9's "since last visit" concept -- an alert seeded before login still
 * counts as shown the moment the first tablero fetch includes it.
 */

export type EstadoTimingAlertas = {
  mostradaEn: Readonly<Record<string, number>>
  abiertaEn: Readonly<Record<string, number>>
}

export const ESTADO_INICIAL_TIMING: EstadoTimingAlertas = { mostradaEn: {}, abiertaEn: {} }

/** Records `ahora` as the first-shown time for every id in `idsVisibles`
 * not already known, returning both the updated state and the subset that
 * was actually new (what the caller should fire `eventoAlertaMostrada` for
 * -- an already-known id must never re-fire it). */
export function registrarMostradas(
  estado: EstadoTimingAlertas,
  idsVisibles: readonly string[],
  ahora: number,
): { estado: EstadoTimingAlertas; nuevas: string[] } {
  const nuevas = idsVisibles.filter((id) => !(id in estado.mostradaEn))
  if (nuevas.length === 0) return { estado, nuevas }

  const mostradaEn = { ...estado.mostradaEn }
  for (const id of nuevas) mostradaEn[id] = ahora
  return { estado: { ...estado, mostradaEn }, nuevas }
}

/** Records `ahora` as this alert's opened time (overwritten on a later
 * re-open of the same alert, which is fine -- msDesdeAbierta below is only
 * ever read right after the matching open/resolve action). */
export function registrarAbierta(estado: EstadoTimingAlertas, alertaId: string, ahora: number): EstadoTimingAlertas {
  return { ...estado, abiertaEn: { ...estado.abiertaEn, [alertaId]: ahora } }
}

export function msDesdeMostrada(estado: EstadoTimingAlertas, alertaId: string, ahora: number): number | null {
  const t = estado.mostradaEn[alertaId]
  return t === undefined ? null : ahora - t
}

export function msDesdeAbierta(estado: EstadoTimingAlertas, alertaId: string, ahora: number): number | null {
  const t = estado.abiertaEn[alertaId]
  return t === undefined ? null : ahora - t
}
