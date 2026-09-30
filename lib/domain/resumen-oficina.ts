import { peorSeveridad } from "@/lib/domain/alerts"
import type { IndicadorPlantaResumen, IndicadorResumenLinea } from "@/lib/domain/floor-repository"

/**
 * G10: pure aggregation for the office Resumen KPI cards -- extracted so the
 * averaging/worst-state rules are unit-testable without either
 * FloorRepository adapter. Shared by InMemoryFloorRepository and
 * SupabaseFloorRepository's `resumenOficina()`.
 */
function redondear1(valor: number): number {
  return Math.round(valor * 10) / 10
}

/** Averages `porLinea[].valor` (0 with no lines, never NaN) and takes the
 * worst of `porLinea[].estado` -- a single line in "parar" must never be
 * hidden by the other two being "ok" (H3's same worst-state rule, reused via
 * `peorSeveridad`). */
export function construirIndicadorResumen(
  clave: string,
  nombre: string,
  unidad: string,
  porLinea: IndicadorResumenLinea[],
): IndicadorPlantaResumen {
  const promedio =
    porLinea.length === 0 ? 0 : redondear1(porLinea.reduce((acc, l) => acc + l.valor, 0) / porLinea.length)
  return {
    clave,
    nombre,
    unidad,
    promedio,
    estado: peorSeveridad(porLinea.map((l) => l.estado)),
    porLinea,
  }
}

const VENTANA_24H_MS = 24 * 60 * 60 * 1000

/**
 * Mean minutes between creation and resolution, over alerts resolved in the
 * last 24h (`ahoraMs - resueltaEn <= 24h`). Returns null when none qualify
 * -- the client renders "—", never a fabricated 0 (same "never fabricate a
 * number" rule as AlertaDetalle's doc).
 */
export function tiempoMedioAtencionMin(
  alertas: readonly { creadaEn: number; resueltaEn: number | null }[],
  ahoraMs: number,
): number | null {
  const resueltasRecientes = alertas.filter(
    (a): a is { creadaEn: number; resueltaEn: number } =>
      a.resueltaEn !== null && ahoraMs - a.resueltaEn <= VENTANA_24H_MS,
  )
  if (resueltasRecientes.length === 0) return null
  const totalMin = resueltasRecientes.reduce((acc, a) => acc + (a.resueltaEn - a.creadaEn) / 60_000, 0)
  return Math.round(totalMin / resueltasRecientes.length)
}
