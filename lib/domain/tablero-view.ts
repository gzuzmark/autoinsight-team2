import { newSinceVisit } from "@/lib/domain/alerts"
import type { Tablero } from "@/lib/domain/floor-repository"
import type { Alerta } from "@/lib/mock-data"

export type VistaTablero = {
  alertasActivas: Alerta[]
  cambiosDesdeUltimaVisita: Alerta[]
  totalNuevosDesdeVisita: number
  esPrimeraVisita: boolean
  ultimoLogoutTs: number | null
}

const VISTA_VACIA: VistaTablero = {
  alertasActivas: [],
  cambiosDesdeUltimaVisita: [],
  totalNuevosDesdeVisita: 0,
  esPrimeraVisita: true,
  ultimoLogoutTs: null,
}

/**
 * Pure derivation of the dashboard's since-last-visit view from a server
 * `Tablero` (T9): kept separate from `AppProvider` so it stays testable with
 * plain Vitest (no React rendering / testing-library needed, matching the
 * rest of this repo's pattern of pushing logic into `lib/domain/*`).
 *
 * `tablero.nuevasIds` is already the server's authoritative "new since last
 * visit" signal (currently-active alerts created after `ultimaVisita`, see
 * the `tablero` RPC and `InMemoryFloorRepository`); this function only
 * reshapes it for the UI, it does not recompute "newness" itself.
 *
 * `totalNuevosDesdeVisita` comes from `tablero.cambiosDesdeVisita` (K2), NOT
 * from `nuevasIds.size`: `nuevasIds` only lists currently-ACTIVE new alerts,
 * so once every new alert since the last visit is resolved, `nuevasIds`
 * empties out and `nuevasIds.size` would wrongly read 0 -- the since-last-
 * visit strip would then claim "Sin cambios" even though something did
 * change (F1 regression). `cambiosDesdeVisita` counts ALL alerts created
 * after `ultimaVisita` regardless of `estado`, so it stays > 0 in that case.
 */
export function derivarVista(tablero: Tablero | null): VistaTablero {
  if (!tablero) return VISTA_VACIA

  const nuevasIds = new Set(tablero.nuevasIds)
  return {
    alertasActivas: tablero.alertas,
    cambiosDesdeUltimaVisita: newSinceVisit(tablero.alertas, nuevasIds),
    totalNuevosDesdeVisita: tablero.cambiosDesdeVisita,
    esPrimeraVisita: tablero.ultimaVisita === null,
    ultimoLogoutTs: tablero.ultimaVisita,
  }
}
