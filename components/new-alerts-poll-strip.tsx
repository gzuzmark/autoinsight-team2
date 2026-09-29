import { BellRing } from "lucide-react"
import { formatearHora, type Alerta } from "@/lib/mock-data"
import { NOTIFICACION } from "@/lib/status"

/**
 * G7a: inline strip for alerts a 15s poll (D29) brought that were not seen
 * on any earlier poll this session -- distinct from D9's since-last-visit
 * strip, which only covers the very first tablero fetch after login.
 *
 * J2 (queued batch J, 2026-09-29) made this strip more salient under glare,
 * replacing G7a's original weak version (16px dot, pale indigo-50
 * background, `text-2xl`) while keeping every floor rule:
 *   - Shape: a large `BellRing` icon (`size-12`, 48px) -- reads as "new",
 *     distinct from the status palette's `CircleCheck`/`TriangleAlert`/
 *     `OctagonAlert` icons in lib/status.tsx, so it is never mistaken for a
 *     KPI/alert-severity icon.
 *   - Count: `text-5xl font-black`, the same size D11 reserves for a
 *     STATE/SEVERITY word (OK/ATENCIÓN/PARAR, ALTA/MEDIA/BAJA) -- this is a
 *     deliberate upgrade from G7a's `text-2xl` count (this is the strip's
 *     whole point, it should read as fast as a state word does).
 *   - "alerta(s) nueva(s) · HH:MM" at `text-3xl` (>= D11's text-2xl floor).
 *   - Strong fill: `NOTIFICACION` (lib/status.tsx) -- a dark indigo
 *     background + white text, a NOTIFICATION color explicitly documented
 *     as never a 4th D10 state, contrast-checked (>= 7:1, AAA) and hue/
 *     luminance-checked against PARAR's dark red in
 *     lib/design-rules.test.ts so the two dark fills can never be confused.
 *   - "Entendido" stays >= 88px (`h-22`/`min-h-22`) with high-contrast
 *     white-on-dark-indigo styling reversed (white fill, indigo text) so it
 *     reads as a distinct control against the strip's own dark fill.
 *   - Still inline (D9, never an overlay/modal); no opacity, no alpha
 *     color, no motion utility of any kind (D12); no gray text -- every
 *     letter here is either white-on-indigo or indigo-on-white, both
 *     AAA-checked.
 */
export function NewAlertsPollStrip({
  alertas,
  onDescartar,
}: {
  alertas: readonly Alerta[]
  onDescartar: () => void
}) {
  if (alertas.length === 0) return null

  const ultimaHora = Math.max(...alertas.map((a) => a.timestamp))

  return (
    <div
      data-testid="new-alerts-poll-strip"
      className={`flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border-4 px-5 py-3 ${NOTIFICACION.fondo} ${NOTIFICACION.borde}`}
    >
      <div className="flex items-center gap-3">
        <BellRing className={`size-12 shrink-0 ${NOTIFICACION.texto}`} aria-hidden />
        <p className={`text-3xl font-black ${NOTIFICACION.texto}`}>
          <span className="text-5xl">{alertas.length}</span>{" "}
          {alertas.length === 1 ? "alerta nueva" : "alertas nuevas"} · {formatearHora(ultimaHora)}
        </p>
      </div>
      <button
        type="button"
        onClick={onDescartar}
        className={`flex h-22 min-h-22 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-white px-6 text-2xl font-black ${NOTIFICACION.textoAcento}`}
      >
        Entendido
      </button>
    </div>
  )
}
