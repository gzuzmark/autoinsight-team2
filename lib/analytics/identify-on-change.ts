/** G8: PostHog participant id format, shared by every call site that needs it. */
export function idParticipante(participante: number): string {
  return `P${participante}`
}

/**
 * Decides whether components/app-provider.tsx should call
 * `identificarParticipante` again on a successful tablero fetch: only the
 * first time (no previous id known yet) and whenever the participant
 * number actually changed (a facilitator "Nuevo participante" mid-poll) --
 * null means "no-op, still the same participant".
 */
export function participanteIdParaIdentificar(idAnterior: string | null, participanteActual: number): string | null {
  const nuevoId = idParticipante(participanteActual)
  return idAnterior === nuevoId ? null : nuevoId
}
