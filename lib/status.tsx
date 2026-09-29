import { CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react"
import type { Severidad } from "./mock-data"

export type EstiloEstado = {
  palabra: string
  Icono: LucideIcon
  /** Relleno fuerte para tarjetas y encabezados. */
  fondo: string
  /** Color de texto sobre el relleno fuerte (contraste AAA). */
  textoSobreFondo: string
  /** Borde grueso para reforzar la forma sin depender del color. */
  borde: string
}

// El estado nunca depende solo del color: se combinan color, palabra,
// icono con forma distinta y tamano. Los tonos separan luminancia relativa
// con claridad entre los tres estados (para lectura en escala de grises) y
// mantienen contraste texto/fondo >= 7:1 (WCAG AAA), medido en
// odd/tasks/autoinsight-port.md:
//   OK        fondo #e7f8ec / texto #0a3d1f  -> luminancia 0.9018, contraste 11.20:1
//   ATENCIÓN  fondo #ffb703 / texto #0a0800  -> luminancia 0.5513, contraste 11.48:1
//   PARAR     fondo #3d0106 / texto #ffffff  -> luminancia 0.0103, contraste 17.42:1
export const ESTILOS: Record<Severidad, EstiloEstado> = {
  ok: {
    palabra: "OK",
    Icono: CircleCheck,
    fondo: "bg-[#e7f8ec]",
    textoSobreFondo: "text-[#0a3d1f]",
    borde: "border-[#0a3d1f]",
  },
  atencion: {
    palabra: "ATENCIÓN",
    Icono: TriangleAlert,
    fondo: "bg-[#ffb703]",
    textoSobreFondo: "text-[#0a0800]",
    borde: "border-[#8a5600]",
  },
  parar: {
    palabra: "PARAR",
    Icono: OctagonAlert,
    fondo: "bg-[#3d0106]",
    textoSobreFondo: "text-white",
    borde: "border-[#770209]",
  },
}

/**
 * J2 (queued batch J, 2026-09-29): fill for the floor's "N alertas nuevas"
 * strip (`components/new-alerts-poll-strip.tsx`). This is a NOTIFICATION
 * color, not a 4th state -- it is never used for a KPI/alert-severity word
 * and must never be confused with the D10 status palette above, especially
 * PARAR's dark red (both are very dark fills). Kept as its own named export
 * instead of a 4th entry in ESTILOS so it can never be indexed by
 * `Severidad` by accident.
 *
 * Chosen dark indigo #241a6e / white text:
 *   - contrast vs white text: 14.50:1 (>= 7:1 AAA-for-large-text plus extra
 *     margin for tablet glare, see lib/design-rules.test.ts).
 *   - hue 247° vs PARAR's hue 355° -> 108° apart (well past the 60° margin
 *     the test requires) -- reads as blue-indigo, not red, even under
 *     glare or in grayscale.
 *   - relative luminance 0.0224 vs PARAR's 0.0103 -- more than double, so
 *     the two dark fills are not perceptually identical either.
 */
export const NOTIFICACION = {
  fondo: "bg-[#241a6e]",
  texto: "text-white",
  borde: "border-[#241a6e]",
  /** Same indigo, as text -- used for the strip's "Entendido" control,
   * which reverses the fill (white background, indigo text) so it still
   * reads as a distinct, high-contrast control against the dark strip. */
  textoAcento: "text-[#241a6e]",
}

// Palabra de severidad para alertas (distinta de la palabra de estado usada
// en KPIs y en el estado vacío): ALTA/MEDIA/BAJA, mapeada 1:1 con
// parar/atencion/ok. Compartida por AlertStack y AlertDetail para que ambos
// muestren siempre la misma palabra.
export const SEVERIDAD_PALABRA: Record<Severidad, string> = {
  parar: "ALTA",
  atencion: "MEDIA",
  ok: "BAJA",
}
