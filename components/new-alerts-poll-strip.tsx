import { formatearHora, type Alerta } from "@/lib/mock-data"

/**
 * G7a: inline strip for alerts a 15s poll (D29) brought that were not seen
 * on any earlier poll this session -- distinct from D9's since-last-visit
 * strip, which only covers the very first tablero fetch after login.
 *
 * Design decisions (documented per the task brief):
 *   - The count/word is `text-2xl`, not `text-5xl`: D11 reserves the larger
 *     size for a STATE/SEVERITY word (OK/ATENCIÓN/PARAR, ALTA/MEDIA/BAJA).
 *     "N alertas nuevas" is a notification count, not one of those words,
 *     so it follows the same `text-2xl` baseline as SinceLastVisit's own
 *     strip text.
 *   - Color + shape + word (D8-style): a solid indigo dot (shape) + the
 *     indigo border/background (color, distinct from the OK/ATENCIÓN/PARAR
 *     palette in lib/status.tsx, so it never reads as a KPI/alert state) +
 *     the "alertas nuevas" word.
 *   - No optional chime: implementing a Web Audio helper that is reliably
 *     muted in tests and only fires after the login gesture was judged more
 *     than "trivially possible" inside this task's time budget -- skipped
 *     per the brief's own allowance ("otherwise skip and say so").
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
      className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border-4 border-indigo-700 bg-indigo-50 px-5 py-2"
    >
      <div className="flex items-center gap-3">
        <span className="size-4 shrink-0 rounded-full bg-indigo-700" aria-hidden />
        <p className="text-2xl font-black text-neutral-900">
          {alertas.length} {alertas.length === 1 ? "alerta nueva" : "alertas nuevas"} · {formatearHora(ultimaHora)}
        </p>
      </div>
      <button
        type="button"
        onClick={onDescartar}
        className="flex h-22 shrink-0 items-center justify-center rounded-2xl border-4 border-indigo-700 bg-white px-6 text-2xl font-black text-neutral-900"
      >
        Entendido
      </button>
    </div>
  )
}
