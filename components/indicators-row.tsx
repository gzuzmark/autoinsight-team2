import { INDICADORES } from "@/lib/mock-data"
import { ESTILOS } from "@/lib/status"

export function IndicatorsRow() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {INDICADORES.map((ind) => {
        const e = ESTILOS[ind.estado]
        const Icono = e.Icono
        return (
          <div
            key={ind.id}
            className={`flex items-center gap-4 rounded-2xl border-4 p-4 ${e.fondo} ${e.borde} ${e.textoSobreFondo}`}
          >
            <Icono className="h-16 w-16 shrink-0" strokeWidth={2.5} aria-hidden />
            <div className="min-w-0">
              <p className="text-[24px] font-bold uppercase tracking-wide">{ind.nombre}</p>
              <p className="mt-1 text-[48px] font-black uppercase leading-none">{e.palabra}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
