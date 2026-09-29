import "server-only"

import { readBackofficeToken } from "@/lib/api/backoffice-cookie"
import { isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
import { getFloorRepository } from "@/lib/floor-repository"

const NO_STORE = { "Cache-Control": "no-store" }
const UNAUTHORIZED = { error: "Sesión de back office inválida." }
const DISABLED = { error: "Back office deshabilitado: falta BACKOFFICE_KEY" }
const INVALID_BODY = { error: "Cuerpo inválido: se espera { enviarReporteTurno: boolean }." }

/** POST /api/backoffice/configuracion (G6): flips the "Enviar reporte al
 * simular turno" toggle (body `{ enviarReporteTurno: boolean }`). Same
 * facilitator-cookie gate as every other back-office route. */
export async function POST(request: Request): Promise<Response> {
  if (!isBackofficeConfigured()) {
    return Response.json(DISABLED, { status: 503, headers: NO_STORE })
  }

  const token = readBackofficeToken(request)
  if (!isValidToken(token)) {
    return Response.json(UNAUTHORIZED, { status: 401, headers: NO_STORE })
  }

  const valor = await parseEnviarReporteTurno(request)
  if (valor === null) {
    return Response.json(INVALID_BODY, { status: 400, headers: NO_STORE })
  }

  await getFloorRepository().setEnviarReporteTurno(valor)

  return Response.json({ ok: true }, { headers: NO_STORE })
}

async function parseEnviarReporteTurno(request: Request): Promise<boolean | null> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return null
  }
  if (typeof json !== "object" || json === null) return null
  const value = (json as Record<string, unknown>).enviarReporteTurno
  return typeof value === "boolean" ? value : null
}
