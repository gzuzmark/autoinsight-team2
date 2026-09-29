import "server-only"

const NO_STORE = { "Cache-Control": "no-store" }
const ERROR_INTERNO = { error: "Error interno del back office. Intenta de nuevo." }

/**
 * D5 (final-demo plan Batch I, 2026-09-29): every back-office route must
 * respond to a non-validation failure (a repository call throwing anything
 * other than `InvalidInputError` -- a Supabase outage, a missing/un-applied
 * migration, etc.) with a JSON error body the dashboard's `ejecutarAccion`
 * (lib/backoffice/acciones.ts) can parse and show inline, `no-store`, 500 --
 * never an unhandled throw, which Next turns into a generic HTML error page
 * with no JSON body `ejecutarAccion` can read (a silently "stuck" busy
 * button instead of the inline error message the brief requires).
 *
 * Logs the underlying error server-side first (same rationale as D4's page
 * logging) so the failure is diagnosable, since the JSON body itself is
 * deliberately generic (never echoes a raw Supabase/PostgREST error, which
 * could carry more detail than a facilitator-facing message should).
 */
export function respuestaErrorInterno(contexto: string, err: unknown): Response {
  console.error(`[backoffice] ${contexto} failed:`, err)
  return Response.json(ERROR_INTERNO, { status: 500, headers: NO_STORE })
}
