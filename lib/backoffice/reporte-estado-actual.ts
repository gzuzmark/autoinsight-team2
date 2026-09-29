import { ESTILOS } from "@/lib/status"
import { formatearFechaHora, type Severidad } from "@/lib/mock-data"
import type { LineaDemoConocida } from "@/lib/domain/floor-repository"
import type { ReporteEmail } from "@/lib/backoffice/reporte-turno"

/**
 * G6 "Enviar correo ahora": a current-state snapshot across every known
 * line, sent on demand (not tied to a single "Simular turno"). Deliberately
 * lighter than `construirReporteTurno` (worst-severity word + open-alert
 * count per line, from `EstadoDemo#lineas` -- no per-line "Simular turno"
 * request context, kept easy on the composition root -- see
 * odd/tasks/guerrilla-backoffice.md's G6 evidence for the tradeoff note).
 */
export type LineaReporteEstado = {
  nombre: LineaDemoConocida
  estado: Severidad
  alertasAbiertas: number
}

export type ReporteEstadoActualInput = {
  fecha: number
  lineas: readonly LineaReporteEstado[]
  appBaseUrl: string
}

export function construirReporteEstadoActual(input: ReporteEstadoActualInput): ReporteEmail {
  const { fecha, lineas, appBaseUrl } = input
  const enlace = `${appBaseUrl.replace(/\/$/, "")}/planta`
  const subject = `Reporte de estado — ${formatearFechaHora(fecha)}`

  const textoLineas =
    lineas.length === 0
      ? "Sin líneas conocidas."
      : lineas
          .map((l) => `${l.nombre}: ${ESTILOS[l.estado].palabra} (${l.alertasAbiertas} alertas abiertas)`)
          .join("\n")

  const htmlLineas =
    lineas.length === 0
      ? "<p>Sin líneas conocidas.</p>"
      : `<ul>${lineas
          .map(
            (l) =>
              `<li>${escapeHtml(l.nombre)}: <strong>${ESTILOS[l.estado].palabra}</strong> (${l.alertasAbiertas} alertas abiertas)</li>`,
          )
          .join("")}</ul>`

  const text = [
    "Reporte de estado — Planta Norte",
    formatearFechaHora(fecha),
    "",
    textoLineas,
    "",
    `Ver el tablero: ${enlace}`,
  ].join("\n")

  const html = `
    <div>
      <h2>Reporte de estado — Planta Norte</h2>
      <p>${escapeHtml(formatearFechaHora(fecha))}</p>
      ${htmlLineas}
      <p><a href="${enlace}">Ver el tablero</a></p>
    </div>
  `.trim()

  return { subject, html, text }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
