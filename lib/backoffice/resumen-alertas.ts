import { SEVERIDAD_PALABRA } from "@/lib/status"
import type { AlertasPorSeveridad } from "@/lib/domain/floor-repository"

// H3: order of severities in the compact summary -- most severe first,
// matching the alert vocabulary (D8: ALTA/MEDIA/BAJA -> parar/atencion/ok).
const ORDEN: Array<keyof AlertasPorSeveridad> = ["parar", "atencion", "ok"]

/**
 * H3 "Estado de la demo" alert summary next to the KPI chip: e.g.
 * "4 alertas · 2 ALTA · 2 MEDIA", or "Sin alertas" when the line has none
 * open. Every non-zero severity is included (decided for the back office,
 * a facilitator-only screen with room to spare -- unlike the floor tablet's
 * "+N alertas menos graves" collapsing, D8), in ALTA/MEDIA/BAJA order.
 */
export function formatearResumenAlertas(counts: AlertasPorSeveridad): string {
  const total = counts.parar + counts.atencion + counts.ok
  if (total === 0) return "Sin alertas"

  const partes = ORDEN.filter((severidad) => counts[severidad] > 0).map(
    (severidad) => `${counts[severidad]} ${SEVERIDAD_PALABRA[severidad]}`,
  )
  return [`${total} alertas`, ...partes].join(" · ")
}
