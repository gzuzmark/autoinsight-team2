import "server-only"

import { readBackofficeToken } from "@/lib/api/backoffice-cookie"
import { isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
import { appBaseUrl, reportRecipients } from "@/lib/backoffice/reporte-config"
import { construirReporteTurno } from "@/lib/backoffice/reporte-turno"
import { esLineaDemoConocida, InvalidInputError, type LineaDemoConocida } from "@/lib/domain/floor-repository"
import { getEmailSender } from "@/lib/email/get-email-sender"
import { enviarConLimite } from "@/lib/email/with-timeout"
import { getFloorRepository } from "@/lib/floor-repository"

const NO_STORE = { "Cache-Control": "no-store" }
const UNAUTHORIZED = { error: "Sesión de back office inválida." }
const DISABLED = { error: "Back office deshabilitado: falta BACKOFFICE_KEY" }
const INVALID_LINEA = { error: "Línea inválida." }

type CorreoStatus = "enviado" | "omitido" | "error"

/** POST /api/backoffice/turno (G2): simulates a shift change on one line
 * (body `{ linea }`, validated against LINEAS_DEMO_CONOCIDAS -- see
 * FloorRepository#simularTurno). Same facilitator-cookie gate as every
 * other back-office route.
 *
 * G6: when the "Enviar reporte al simular turno" toggle is ON (default),
 * also sends a shift-report email. An email failure must NOT fail the
 * shift itself -- the shift has already happened by the time the email is
 * attempted -- so this always responds 200 `{ ok: true, correo }`, where
 * `correo` is "enviado" | "omitido" (toggle OFF) | "error" (send failed).
 */
export async function POST(request: Request): Promise<Response> {
  if (!isBackofficeConfigured()) {
    return Response.json(DISABLED, { status: 503, headers: NO_STORE })
  }

  const token = readBackofficeToken(request)
  if (!isValidToken(token)) {
    return Response.json(UNAUTHORIZED, { status: 401, headers: NO_STORE })
  }

  const linea = await parseLinea(request)
  if (!linea) {
    return Response.json(INVALID_LINEA, { status: 400, headers: NO_STORE })
  }

  const repo = getFloorRepository()
  let reporte
  try {
    reporte = await repo.simularTurno(linea)
  } catch (err) {
    if (err instanceof InvalidInputError) {
      return Response.json(INVALID_LINEA, { status: 400, headers: NO_STORE })
    }
    throw err
  }

  const correo = await enviarReporteSiCorresponde(repo, reporte)

  return Response.json({ ok: true, correo }, { headers: NO_STORE })
}

async function enviarReporteSiCorresponde(
  repo: ReturnType<typeof getFloorRepository>,
  reporte: Awaited<ReturnType<typeof repo.simularTurno>>,
): Promise<CorreoStatus> {
  try {
    const estado = await repo.estadoDemo()
    if (!estado.enviarReporteTurno) return "omitido"
    // E1: the shift committed, but the report-enrichment reads failed
    // (SupabaseFloorRepository degrades instead of throwing -- see
    // ReporteTurnoDatos#datosDisponibles's doc) -- there is nothing
    // meaningful to send.
    if (!reporte.datosDisponibles) return "error"

    const email = construirReporteTurno({
      linea: reporte.linea,
      fecha: Date.now(),
      nuevasAlertas: reporte.nuevasAlertas,
      indicadores: reporte.indicadores,
      alertasAbiertas: reporte.alertasAbiertas,
      appBaseUrl: appBaseUrl(),
    })
    // E2: bounded overall so a slow/unreachable SMTP cannot hold this
    // response open indefinitely -- the shift already happened either way.
    await enviarConLimite(getEmailSender(), { to: reportRecipients(), ...email })
    return "enviado"
  } catch {
    return "error"
  }
}

async function parseLinea(request: Request): Promise<LineaDemoConocida | null> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return null
  }
  if (typeof json !== "object" || json === null) return null
  const value = (json as Record<string, unknown>).linea
  return esLineaDemoConocida(value) ? value : null
}
