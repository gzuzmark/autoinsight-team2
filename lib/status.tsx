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
// icono con forma distinta y tamano. Los tonos buscan contraste alto (>= 7:1)
// para resistir reflejos en el piso de planta.
export const ESTILOS: Record<Severidad, EstiloEstado> = {
  ok: {
    palabra: "OK",
    Icono: CircleCheck,
    fondo: "bg-[#0b5d33]",
    textoSobreFondo: "text-white",
    borde: "border-[#053d20]",
  },
  atencion: {
    palabra: "ATENCIÓN",
    Icono: TriangleAlert,
    fondo: "bg-[#f5b301]",
    textoSobreFondo: "text-[#1a1400]",
    borde: "border-[#8a6400]",
  },
  parar: {
    palabra: "PARAR",
    Icono: OctagonAlert,
    fondo: "bg-[#c1121f]",
    textoSobreFondo: "text-white",
    borde: "border-[#6b0a11]",
  },
}
