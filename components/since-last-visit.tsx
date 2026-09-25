import { groupChangesByStation } from "@/lib/domain/alerts"
import { formatearHora, type Alerta } from "@/lib/mock-data"

const MAX_STATION_LINES = 2

export function SinceLastVisit({
  primeraVisita,
  cambios,
  totalNuevos,
  ultimoLogoutTs,
}: {
  primeraVisita: boolean
  cambios: Alerta[]
  /** How many alerts were marked "new" at login/shift-simulation time, even
   * if some (or all) of them have since left the active list (F1). Used to
   * tell "nothing ever changed" (show "Sin cambios") apart from "everything
   * that changed has already been resolved" (show nothing at all). */
  totalNuevos: number
  ultimoLogoutTs: number | null
}) {
  if (primeraVisita) return null

  if (cambios.length === 0) {
    // F1: if there WERE new alerts since the last visit but all of them have
    // since been attended/marked no-aplica, the strip must not claim nothing
    // changed — it hides instead of showing a misleading message.
    if (totalNuevos > 0) return null

    return (
      <div className="flex shrink-0 flex-col gap-1 rounded-2xl border-4 border-neutral-200 bg-white px-5 py-2">
        <p className="text-2xl font-semibold leading-tight text-neutral-900">
          <span className="font-black uppercase">Desde tu última visita: </span>
          Sin cambios desde tu última visita
          {ultimoLogoutTs !== null ? `, ${formatearHora(ultimoLogoutTs)}` : ""}
        </p>
      </div>
    )
  }

  const grupos = groupChangesByStation(cambios)
  const visibles = grupos.length <= MAX_STATION_LINES ? grupos : grupos.slice(0, MAX_STATION_LINES)
  const restantes = grupos.length - visibles.length

  return (
    <div className="flex shrink-0 flex-col gap-1 rounded-2xl border-4 border-neutral-200 bg-white px-5 py-2">
      {visibles.map((g, i) => (
        <p key={g.estacion} className="text-2xl font-semibold leading-tight text-neutral-900">
          {i === 0 && <span className="font-black uppercase">Desde tu última visita: </span>}
          {g.alertas.length} {g.alertas.length === 1 ? "alerta nueva" : "alertas nuevas"} en {g.estacion}
        </p>
      ))}
      {restantes > 0 && (
        <p className="text-2xl font-semibold leading-tight text-neutral-900">
          +{restantes} {restantes === 1 ? "estación más" : "estaciones más"}
        </p>
      )}
    </div>
  )
}
