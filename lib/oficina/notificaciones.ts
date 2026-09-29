/**
 * G9: office notification bell -- pure decision logic, kept separate from
 * localStorage I/O (same split as lib/oficina/push-toggle-logic.ts /
 * push-support.ts) so it is unit-testable with no browser environment.
 * Read state is tracked PER BROWSER (localStorage), never sent to the
 * server: two different desks looking at the same alert each track their
 * own "read" state independently.
 */
import type { NotificacionAlerta } from "@/lib/domain/floor-repository"

const STORAGE_KEY = "oficina.notificaciones.leidas"

export function esNoLeida(notificacion: NotificacionAlerta, idsLeidos: ReadonlySet<string>): boolean {
  return !idsLeidos.has(notificacion.id)
}

export function contarNoLeidas(notificaciones: readonly NotificacionAlerta[], idsLeidos: ReadonlySet<string>): number {
  return notificaciones.filter((n) => esNoLeida(n, idsLeidos)).length
}

/** Never mutates `idsLeidos` -- callers (a client component's state setter)
 * rely on getting a new Set back. */
export function marcarLeida(idsLeidos: ReadonlySet<string>, id: string): Set<string> {
  return new Set([...idsLeidos, id])
}

/** "Marcar todas como leídas": every currently-listed notification id,
 * merged with whatever was already read (never forgets an id that scrolled
 * out of the current page/window). */
export function marcarTodasLeidas(
  notificaciones: readonly NotificacionAlerta[],
  idsLeidos: ReadonlySet<string>,
): Set<string> {
  return new Set([...idsLeidos, ...notificaciones.map((n) => n.id)])
}

/** Unread badge text: hidden (null) at 0, exact count under 10, capped at
 * "9+" from 10 up (YouTube-style). */
export function etiquetaContador(cantidad: number): string | null {
  if (cantidad <= 0) return null
  if (cantidad >= 10) return "9+"
  return String(cantidad)
}

/** Reads the read-id set from localStorage. Wrapped in try/catch (private
 * browsing, blocked storage, SSR with no `window`, or corrupted/foreign
 * JSON) -- any failure degrades to "nothing read yet" instead of throwing,
 * since this is a per-browser convenience, never state the bell can't
 * function without. */
export function leerIdsLeidos(): Set<string> {
  try {
    if (typeof window === "undefined") return new Set()
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((v): v is string => typeof v === "string"))
  } catch {
    return new Set()
  }
}

/** Persists the read-id set. Wrapped in try/catch for the same reasons as
 * `leerIdsLeidos` -- a failed write is silently ignored, never surfaced to
 * the user (the bell still works for the rest of this session, it just
 * won't remember "read" across a reload). */
export function guardarIdsLeidos(ids: ReadonlySet<string>): void {
  try {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Best-effort only -- see the doc comment above.
  }
}
