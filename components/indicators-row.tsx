import type { IndicadorTablero } from "@/lib/domain/floor-repository"
import { ESTILOS } from "@/lib/status"

// D11/D27: the state word (text-5xl, e.g. "ATENCIÓN", 8 uppercase letters at
// font-black) needs ~247px of its own line to never clip -- measured live
// against the rendered font (Chromium's default sans stack; see
// odd/tasks/guerrilla-backoffice.md, bug 2026-09-29 entry). Icon-beside-word
// (the kiosk layout) only leaves that much room once a grid column is wide
// enough (icon 64px + gap 16px + padding/border 40px = 120px overhead); the
// old `md:grid-cols-3` (768px) put columns as narrow as ~235px, well under
// the ~367px a row layout needs. Below kiosk the icon stacks ABOVE the word
// instead (removing that 120px overhead per column), which fits a 3-column
// grid all the way down to the standard `lg` breakpoint (1024px, ~320px
// columns) with comfortable margin, and keeps a single column safe from
// 320px up (measured with ~34-280px of slack depending on width). Kiosk
// (>=1280x800, always 3 columns) keeps the original icon-left row layout,
// which has ~285px of margin there. `break-words` is a defense-in-depth
// fallback only: at the bare 320px floor the single-column margin is ~1.5px
// (word 246.44px vs 248px available), thin enough that a slightly different
// font build should still never visibly clip.
export function IndicatorsRow({ indicadores }: { indicadores: IndicadorTablero[] }) {
  return (
    <div data-testid="indicators-row" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {indicadores.map((ind) => {
        const e = ESTILOS[ind.estado]
        const Icono = e.Icono
        return (
          <div
            key={ind.id}
            className={`flex flex-col items-center gap-2 rounded-2xl border-4 p-4 text-center kiosk:flex-row kiosk:items-center kiosk:gap-4 kiosk:text-left ${e.fondo} ${e.borde} ${e.textoSobreFondo}`}
          >
            <Icono className="h-16 w-16 shrink-0" strokeWidth={2.5} aria-hidden />
            <div className="min-w-0">
              <p className="text-2xl font-bold uppercase tracking-wide">{ind.nombre}</p>
              <p className="mt-1 break-words text-5xl font-black uppercase leading-none">{e.palabra}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
