"use client"

import { idParticipante } from "@/lib/analytics/identify-on-change"

/**
 * G8: client-side fetch of the current participant number for office
 * events (GET /api/oficina/participante -- no session/auth on /oficina,
 * O-D4). Degrades to "P1" on any fetch failure -- an analytics-identify
 * field must never block or error the office screen it is attached to.
 * Not cached: the office has no persistent participant context (unlike the
 * floor's Tablero#participante, refreshed every poll), so each capture
 * site reads a fresh value.
 */
export async function obtenerIdParticipanteOficina(): Promise<string> {
  try {
    const res = await fetch("/api/oficina/participante")
    if (!res.ok) return idParticipante(1)
    const body = (await res.json()) as { participante?: unknown }
    return typeof body.participante === "number" ? idParticipante(body.participante) : idParticipante(1)
  } catch {
    return idParticipante(1)
  }
}
