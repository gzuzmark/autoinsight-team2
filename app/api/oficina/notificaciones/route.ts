import "server-only"

import { getFloorRepository } from "@/lib/floor-repository"

const NO_STORE = { "Cache-Control": "no-store" }

/**
 * GET /api/oficina/notificaciones (G9): office notification bell data
 * source. The office has no session/auth (O-D4, same as every other
 * /api/oficina/** route) -- returns only what the office already shows
 * elsewhere for each recent ALTA alert (id, title, severity, line,
 * station, created_at). A repository failure degrades to an empty list
 * (never fails the bell just to report notifications -- same pattern as
 * GET /api/oficina/participante degrading to 1).
 */
export async function GET(): Promise<Response> {
  try {
    const notificaciones = await getFloorRepository().alertasAltaRecientes()
    return Response.json({ notificaciones }, { headers: NO_STORE })
  } catch (err) {
    console.error("[oficina] notificaciones failed:", err)
    return Response.json({ notificaciones: [] }, { headers: NO_STORE })
  }
}
