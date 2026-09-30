import "server-only"

import { getFloorRepository } from "@/lib/floor-repository"

const NO_STORE = { "Cache-Control": "no-store" }

/**
 * GET /api/oficina/resumen (G10): office Resumen live-data source (KPI
 * cards + "Últimas alertas" table). No auth on /oficina (O-D4, same as
 * every other /api/oficina/** route). A repository failure degrades to
 * `{ resumen: null, error }` instead of a 500/throw -- the client keeps
 * showing its last good render (same best-effort pattern as
 * GET /api/oficina/notificaciones degrading to an empty list) rather than
 * crashing the whole Resumen screen over one failed poll.
 */
export async function GET(): Promise<Response> {
  try {
    const resumen = await getFloorRepository().resumenOficina()
    return Response.json({ resumen }, { headers: NO_STORE })
  } catch (err) {
    console.error("[oficina] resumen failed:", err)
    return Response.json({ resumen: null, error: "No se pudo obtener el resumen de planta." }, { headers: NO_STORE })
  }
}
