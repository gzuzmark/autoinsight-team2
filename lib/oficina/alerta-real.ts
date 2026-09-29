// G7b: maps a real FloorRepository#obtenerAlerta result onto the office
// investigation screen's AlertaOficina shape (lib/oficina/mock-data.ts),
// which the page already knows how to render. Pure/unit-tested so the
// mapping (what's real vs. sample-filled) is verifiable without a repository.
import type { AlertaDetalle } from "@/lib/domain/floor-repository"
import { SEVERIDAD_PALABRA } from "@/lib/status"
import { formatearHora } from "@/lib/mock-data"
import type { AlertaOficina, EstadoAlerta as EstadoAlertaOficina } from "@/lib/oficina/mock-data"

const ESTADO_MAP: Record<AlertaDetalle["estado"], EstadoAlertaOficina> = {
  nueva: "Nueva",
  atendida: "Atendida",
  no_aplica: "No aplica",
}

/** "valor / limite unidad" when both are known (Supabase-sourced alerts);
 * "Sin datos" in mock mode, where AlertaDetalle never carries a reading
 * (see AlertaDetalle's own doc) -- never a fabricated number. */
function valorLimiteTexto(detalle: AlertaDetalle): string {
  if (detalle.valor === null || detalle.limite === null) return "Sin datos"
  const unidad = detalle.unidad ? ` ${detalle.unidad}` : ""
  return `${detalle.valor}${unidad} / ${detalle.limite}${unidad}`
}

/**
 * Sections with no real backing data (chart series, 8D root-cause panel,
 * history beyond created/resolved) keep placeholder sample content so the
 * screen is not empty -- `esReal: true` tells the page to label them
 * "Ejemplo" instead of passing them off as real (decided: label, don't
 * hide, so the facilitator still has something to click through during a
 * session).
 */
export function alertaDetalleAOficina(detalle: AlertaDetalle): AlertaOficina {
  const historial: AlertaOficina["historial"] = [
    {
      hora: formatearHora(detalle.creadaEn),
      titulo: "Alerta creada",
      detalle: detalle.unidad && detalle.valor !== null && detalle.limite !== null
        ? `${detalle.valor} ${detalle.unidad} vs. límite ${detalle.limite} ${detalle.unidad}`
        : "Registrada por el sistema",
      estado: detalle.severidad,
    },
  ]
  if (detalle.resueltaEn !== null) {
    historial.push({
      hora: formatearHora(detalle.resueltaEn),
      titulo: detalle.estado === "atendida" ? "Marcada como Atendida" : "Marcada como No aplica",
      detalle: "",
      estado: "ok",
    })
  }

  return {
    id: detalle.id,
    gravedad: SEVERIDAD_PALABRA[detalle.severidad] as AlertaOficina["gravedad"],
    titulo: detalle.titulo,
    linea: detalle.linea,
    estacion: detalle.estacion ?? "Sin estación",
    lineaEstacion: `${detalle.linea} - ${detalle.estacion ?? "Sin estación"}`,
    valorLimite: valorLimiteTexto(detalle),
    turno: "—",
    estado: ESTADO_MAP[detalle.estado],
    hace: formatearHora(detalle.creadaEn),
    // No chart series/8D backing data behind a real alert yet (G7b scope) --
    // placeholder content, labeled "Ejemplo" by the page.
    metrica: {
      titulo: detalle.titulo,
      unidad: detalle.unidad ?? "",
      limite: detalle.limite ?? 0,
      direccion: "arriba",
      serie: [],
    },
    historial,
    ocho_d: [],
    ocho_d_progreso: "Sin análisis 8D para esta alerta",
    esReal: true,
  }
}
