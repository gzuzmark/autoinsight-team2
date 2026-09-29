/**
 * I-1 (RDD review G7b follow-up, 2026-09-29): pure formatting for the
 * inline "Turno simulado" / scenario messages shown in
 * components/backoffice/backoffice-dashboard.tsx, kept separate so the
 * combination logic (correo + push, either of which can be "omitido") is
 * unit-testable without rendering the component -- same rationale as
 * lib/backoffice/resumen-alertas.ts.
 */

type CorreoStatus = "enviado" | "omitido" | "error"
type PushStatus = "enviado" | "sin_suscripciones" | "error" | "omitido"

const TEXTO_CORREO: Partial<Record<CorreoStatus, string>> = {
  enviado: "reporte enviado",
  error: "no se pudo enviar el reporte",
}

const TEXTO_PUSH: Partial<Record<PushStatus, string>> = {
  enviado: "push enviado",
  sin_suscripciones: "sin navegadores suscritos para push",
  error: "no se pudo enviar el push",
}

/** POST /api/backoffice/turno reports both `correo` and `push` (never
 * fails the shift on either). Returns null when there is nothing worth
 * telling the facilitator (both "omitido"/absent), otherwise a single
 * combined "Turno simulado · …" line. */
export function formatearMensajeTurno(correo: string | undefined, push: string | undefined): string | null {
  const partes = [TEXTO_CORREO[correo as CorreoStatus], TEXTO_PUSH[push as PushStatus]].filter(
    (parte): parte is string => Boolean(parte),
  )
  if (partes.length === 0) return null
  return `Turno simulado · ${partes.join(" · ")}`
}

/** POST /api/backoffice/escenario only reports `push` (no email trigger on
 * a scenario). Returns null when there is nothing worth telling the
 * facilitator ("omitido"/absent -- the scenario generated no ALTA alert). */
export function formatearMensajeEscenario(push: string | undefined): string | null {
  return TEXTO_PUSH[push as PushStatus] ?? null
}
