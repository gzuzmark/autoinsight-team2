import type { Alerta, Severidad } from "@/lib/mock-data"

const SEVERITY_RANK: Record<Severidad, number> = { parar: 0, atencion: 1, ok: 2 }

/**
 * Sorts alerts by severity rank (parar > atencion > ok), then by newest
 * timestamp first. Ties (same severity and timestamp) keep their relative
 * input order (stable sort). Does not mutate the input; returns a new array.
 */
export function sortAlerts(alerts: readonly Alerta[]): Alerta[] {
  return [...alerts].sort((a, b) => {
    const rankDiff = SEVERITY_RANK[a.severidad] - SEVERITY_RANK[b.severidad]
    if (rankDiff !== 0) return rankDiff
    return b.timestamp - a.timestamp
  })
}

/** Returns the alerts with estado "nueva", sorted (see sortAlerts). */
export function activeAlerts(alerts: readonly Alerta[]): Alerta[] {
  return sortAlerts(alerts.filter((a) => a.estado === "nueva"))
}

/**
 * Sets estado to "atendida" on the alert matching `id`.
 * No-op contract: if `id` is unknown or the alert is already attended, the
 * SAME array reference is returned (no new array, no new objects) so callers
 * can skip re-rendering. Does not mutate the input.
 */
export function attendAlert(alerts: readonly Alerta[], id: string): Alerta[] {
  const target = alerts.find((a) => a.id === id)
  if (!target || target.estado === "atendida") return alerts as Alerta[]
  return alerts.map((a) => (a.id === id ? { ...a, estado: "atendida" } : a))
}

/**
 * Sets estado to "no_aplica" on the alert matching `id`.
 * No-op contract: if `id` is unknown or the alert is already "no_aplica", the
 * SAME array reference is returned (no new array, no new objects) so callers
 * can skip re-rendering. Does not mutate the input.
 */
export function dismissAlert(alerts: readonly Alerta[], id: string): Alerta[] {
  const target = alerts.find((a) => a.id === id)
  if (!target || target.estado === "no_aplica") return alerts as Alerta[]
  return alerts.map((a) => (a.id === id ? { ...a, estado: "no_aplica" } : a))
}

/**
 * Returns active alerts new since the user's last visit.
 * `seenIds` undefined means first visit: returns [] (nothing to compare against).
 * Otherwise returns active alerts whose id is not in `seenIds`, sorted.
 */
export function changesSinceLastVisit(
  alerts: readonly Alerta[],
  seenIds: readonly string[] | undefined,
): Alerta[] {
  if (seenIds === undefined) return []
  const seen = new Set(seenIds)
  return activeAlerts(alerts).filter((a) => !seen.has(a.id))
}

/**
 * Returns the subset of `active` whose id is in `newIds` (the ids recorded
 * as new at login/shift-simulation time). Because `active` already excludes
 * attended/no_aplica alerts, an id that was new but has since been resolved
 * simply falls out of this result — the caller does not need to remove it
 * from `newIds` itself.
 */
export function newSinceVisit(active: readonly Alerta[], newIds: ReadonlySet<string>): Alerta[] {
  return active.filter((a) => newIds.has(a.id))
}

export type StationChangeGroup = {
  estacion: string
  alertas: Alerta[]
}

/**
 * Groups `changes` by station, preserving the order stations first appear
 * in. Callers pass already-sorted changes (see sortAlerts/activeAlerts), so
 * the most severe station keeps appearing first.
 */
export function groupChangesByStation(changes: readonly Alerta[]): StationChangeGroup[] {
  const order: string[] = []
  const byStation = new Map<string, Alerta[]>()
  for (const a of changes) {
    let group = byStation.get(a.estacion)
    if (!group) {
      group = []
      byStation.set(a.estacion, group)
      order.push(a.estacion)
    }
    group.push(a)
  }
  return order.map((estacion) => ({ estacion, alertas: byStation.get(estacion)! }))
}

export type FocusTarget = { kind: "alert"; id: string } | { kind: "empty" }

/**
 * Decides which alert card should receive focus after `resolvedId` is
 * removed from `visibleIds` (the ids currently rendered, top to bottom,
 * BEFORE removal): the card that now occupies the resolved alert's old
 * position, falling back to the first remaining card, or "empty" when none
 * remain.
 */
export function focusTargetAfterResolve(
  visibleIds: readonly string[],
  resolvedId: string,
): FocusTarget {
  const index = visibleIds.indexOf(resolvedId)
  const remaining = visibleIds.filter((id) => id !== resolvedId)
  if (remaining.length === 0) return { kind: "empty" }
  const id = remaining[index] ?? remaining[0]
  return { kind: "alert", id }
}

export type MergeShiftAlertsResult = {
  alerts: Alerta[]
  added: Alerta[]
}

/**
 * Merges `incoming` shift alerts into `alerts`, deduping by id against both
 * `alerts` and duplicate ids within `incoming` itself (first occurrence
 * wins). Alerts that pass dedup are stamped with `timestamp: now` and
 * included in `added`. The result is sorted (see sortAlerts).
 * No-op contract: if nothing is added, `added` is [] and `alerts` is the
 * SAME input array reference. Does not mutate either input array.
 */
export function mergeShiftAlerts(
  alerts: readonly Alerta[],
  incoming: readonly Alerta[],
  now: number,
): MergeShiftAlertsResult {
  const existingIds = new Set(alerts.map((a) => a.id))
  const seenIncomingIds = new Set<string>()
  const added = incoming
    .filter((a) => {
      if (existingIds.has(a.id) || seenIncomingIds.has(a.id)) return false
      seenIncomingIds.add(a.id)
      return true
    })
    .map((a) => ({ ...a, timestamp: now }))

  if (added.length === 0) {
    return { alerts: alerts as Alerta[], added: [] }
  }

  return { alerts: sortAlerts([...alerts, ...added]), added: sortAlerts(added) }
}
