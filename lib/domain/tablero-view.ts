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
 */
export function derivarVista(tablero: Tablero | null): VistaTablero {
  if (!tablero) return VISTA_VACIA

  const nuevasIds = new Set(tablero.nuevasIds)
  return {
    alertasActivas: tablero.alertas,
    cambiosDesdeUltimaVisita: newSinceVisit(tablero.alertas, nuevasIds),
    totalNuevosDesdeVisita: nuevasIds.size,
    esPrimeraVisita: tablero.ultimaVisita === null,
    ultimoLogoutTs: tablero.ultimaVisita,
  }
}
