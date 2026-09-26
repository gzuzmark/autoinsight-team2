import "server-only"

import { getFloorRepository } from "@/lib/floor-repository"

export async function GET(): Promise<Response> {
  const usuarios = await getFloorRepository().usuariosLogin()
  return Response.json(usuarios, { headers: { "Cache-Control": "no-store" } })
}
