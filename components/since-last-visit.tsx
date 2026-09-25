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

  const visibles = cambios.slice(0, 3)

  return (
    <div className="flex shrink-0 flex-col gap-1 rounded-2xl border-4 border-neutral-200 bg-white px-5 py-2">
      {visibles.length === 0 ? (
        <p className="text-2xl font-semibold leading-tight text-neutral-900">
          <span className="font-black uppercase">Desde tu última visita: </span>
          Sin cambios desde tu última visita
          {ultimoLogoutTs !== null ? `, ${formatearHora(ultimoLogoutTs)}` : ""}
        </p>
      ) : (
        visibles.map((a, i) => (
          <p key={a.id} className="text-2xl font-semibold leading-tight text-neutral-900">
            {i === 0 && <span className="font-black uppercase">Desde tu última visita: </span>}
            1 alerta nueva en {a.estacion}
          </p>
        ))
      )}
    </div>
  )
}
