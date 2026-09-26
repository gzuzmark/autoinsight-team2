import type { Indicador, Severidad } from "@/lib/mock-data"
import type { IndicadorTablero } from "@/lib/domain/floor-repository"

/**
 * KPI-state derivation (D24): a tile's state word is never stored on its
 * own, it is always computed from the indicator's latest `valor` and its
 * per-indicator direction/thresholds. Mirrors the SQL function
 * `private.estado_indicador` in
 * `supabase/migrations/20260926000015_indicador_thresholds_and_readings.sql`
 * verbatim (same operators, same boundaries) so the mock adapter and the
 * Supabase adapter agree on every value.
 *
 * Boundaries (both directions use the same strict comparison sense as
 * `mayorEsMejor`): a value exactly ON a threshold falls into the BETTER
 * band, matching the discovery examples ("FPY higher-is-better: atencion <
 * 92, parar < 90" and "Defectos lower-is-better: atencion > 4, parar > 6").
 */
export function estadoIndicador(
  valor: number,
  mayorEsMejor: boolean,
  umbralAtencion: number,
  umbralParar: number,
): Severidad {
  if (mayorEsMejor) {
    if (valor < umbralParar) return "parar"
    if (valor < umbralAtencion) return "atencion"
    return "ok"
  }
  if (valor > umbralParar) return "parar"
  if (valor > umbralAtencion) return "atencion"
  return "ok"
}

/** Derives the KPI tile shape (D5: name + state word + icon, no numeric
 * value) from a raw indicator reading. */
export function indicadorATablero(indicador: Indicador): IndicadorTablero {
  return {
    id: indicador.id,
    nombre: indicador.nombre,
    detalle: indicador.detalle,
    estado: estadoIndicador(
      indicador.valor,
      indicador.mayorEsMejor,
      indicador.umbralAtencion,
      indicador.umbralParar,
    ),
  }
}
