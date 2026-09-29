/**
 * Batch I (final-demo plan, 2026-09-29): short KPI labels for the back
 * office's per-line KPI chips ("FPY ATENCIÓN · Defectos/h ATENCIÓN · Scrap
 * OK"), keyed by `IndicadorEstadoDemo#clave`. Deliberately shorter than the
 * floor tablet's own `nombre` ("Defectos / hora") -- the back office packs
 * 3 chips per line, unlike the floor's dedicated tile per KPI.
 */
const ETIQUETAS: Record<string, string> = {
  fpy: "FPY",
  dph: "Defectos/h",
  scrap: "Scrap",
}

/** Falls back to the raw clave for an unknown key instead of throwing --
 * a future new KPI still renders something rather than crashing the card. */
export function etiquetaIndicador(clave: string): string {
  return ETIQUETAS[clave] ?? clave
}
