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
            <Icono className="h-14 w-14 shrink-0" strokeWidth={2.5} aria-hidden />
            <div className="min-w-0">
              <p className="text-[20px] font-bold uppercase tracking-wide opacity-90">
                {ind.nombre}
              </p>
              <p className="text-[44px] font-black leading-none">{ind.valor}</p>
              <p className="mt-1 text-[22px] font-black uppercase leading-none">{e.palabra}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
