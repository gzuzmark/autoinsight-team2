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
