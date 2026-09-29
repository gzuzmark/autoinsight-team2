import "server-only"

import { getFloorRepository } from "@/lib/floor-repository"

const NO_STORE = { "Cache-Control": "no-store" }

/** GET /api/oficina/participante (G8): the office has no session/auth
 * (O-D4, same as every other /api/oficina/** route) -- this only exposes
 * the current participant NUMBER so the office screens can identify their
 * PostHog events ("P<n>") the same way the floor does after login. A
 * repository failure degrades to 1 (never fails the office screen just to
 * report an analytics-identify field). */
export async function GET(): Promise<Response> {
  let participante = 1
  try {
    const estado = await getFloorRepository().estadoDemo()
    if (typeof estado.participanteActual === "number") participante = estado.participanteActual
  } catch (err) {
    console.error("[oficina] participante actual failed:", err)
  }
  return Response.json({ participante }, { headers: NO_STORE })
}
