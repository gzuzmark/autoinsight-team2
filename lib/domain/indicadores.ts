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

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * D26: a "recovery reading" moves an indicator ONE state toward ok, with a
 * value inside the new (better) band:
 *   - parar -> a value inside the atencion band (the midpoint between the
 *     parar and atencion thresholds).
 *   - atencion -> a value just inside the ok band.
 *   - ok -> stays ok (a small, direction-safe nudge; still refreshes
 *     `actualizadoEn` so "desactualizado" clears).
 * Never lets a lower-is-better valor go negative.
 */
export function recuperarIndicador(indicador: Indicador, ahora: number): Indicador {
  const { valor, mayorEsMejor, umbralAtencion, umbralParar } = indicador
  const estadoActual = estadoIndicador(valor, mayorEsMejor, umbralAtencion, umbralParar)

  let nuevoValor: number
  if (estadoActual === "parar") {
    nuevoValor = (umbralParar + umbralAtencion) / 2
  } else if (estadoActual === "atencion") {
    const paso = Math.max(Math.abs(umbralAtencion) * 0.02, 0.1)
    nuevoValor = mayorEsMejor ? umbralAtencion + paso : Math.max(umbralAtencion - paso, 0)
  } else {
    const paso = Math.max(Math.abs(valor) * 0.01, 0.05)
    nuevoValor = mayorEsMejor ? valor + paso : Math.max(valor - paso, 0)
  }

  return { ...indicador, valor: redondear(nuevoValor), actualizadoEn: ahora }
}
