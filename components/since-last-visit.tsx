import { formatearHora, type Alerta } from "@/lib/mock-data"

export function SinceLastVisit({
  primeraVisita,
  cambios,
  ultimoLogoutTs,
}: {
  primeraVisita: boolean
  cambios: Alerta[]
  ultimoLogoutTs: number | null
}) {
  if (primeraVisita) return null

  return (
    <div className="flex flex-col gap-2 rounded-2xl border-4 border-neutral-200 bg-white px-5 py-3">
      <p className="text-[24px] font-black uppercase tracking-wide text-neutral-900">
        Desde tu última visita
      </p>
      {cambios.length === 0 ? (
        <p className="text-[24px] font-semibold text-neutral-600">
          Sin cambios desde tu última visita{ultimoLogoutTs !== null ? `, ${formatearHora(ultimoLogoutTs)}` : ""}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {cambios.slice(0, 3).map((a) => (
            <li key={a.id} className="text-[24px] font-semibold text-neutral-800">
              1 alerta nueva en {a.estacion}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
