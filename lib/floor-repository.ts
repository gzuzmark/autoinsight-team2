import "server-only"

import type { FloorRepository } from "@/lib/domain/floor-repository"
import { InMemoryFloorRepository } from "@/lib/domain/in-memory-floor-repository"
import { SupabaseFloorRepository } from "@/lib/domain/supabase-floor-repository"

/**
 * Composition root (D19): picks the adapter from `DATA_SOURCE` (server env,
 * default "mock"). `mock` needs no configuration and reproduces today's
 * behavior; `supabase` requires `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
 * (never `NEXT_PUBLIC_*` -- D20).
 *
 * The in-memory adapter is a module-level singleton (its whole point is to
 * hold state across requests within one server instance); the Supabase
 * adapter is stateless (the database is the state) but is still cached here
 * to avoid re-creating a client per request.
 *
 * G3 fix: Next.js's dev server compiles Route Handlers (under app/api) and
 * Server Components (page.tsx files) as separate bundles/layers, each of
 * which can end up with its OWN evaluation of this module -- a plain
 * module-level `let instance` was then NOT actually shared between e.g.
 * `POST /api/backoffice/escenario` (which mutated one instance) and
 * `BackofficePage`'s Server Component render (which read a DIFFERENT,
 * never-mutated instance), so the back office's "Estado de la demo"/
 * "Cambiar turno"/"Escenarios" cards silently never reflected the action
 * that had just run in dev mode (production's single bundle is unaffected,
 * but dev mode is what a facilitator actually runs the session on). Reusing
 * the value stashed on `globalThis` across module evaluations (a standard
 * Next.js dev-mode HMR-safe-singleton pattern -- see the docs for the same
 * fix applied to a Prisma client) makes it a true single instance again.
 */
const GLOBAL_KEY = Symbol.for("autoinsight.floorRepository")
type GlobalWithRepo = typeof globalThis & { [GLOBAL_KEY]?: FloorRepository }

export function getFloorRepository(): FloorRepository {
  const g = globalThis as GlobalWithRepo
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createFloorRepository()
  }
  return g[GLOBAL_KEY]
}

function createFloorRepository(): FloorRepository {
  const source = process.env.DATA_SOURCE ?? "mock"

  if (source === "supabase") {
    const url = process.env.SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!url || !secretKey) {
      throw new Error(
        "DATA_SOURCE=supabase requires SUPABASE_URL and SUPABASE_SECRET_KEY to be set (see .env.example).",
      )
    }
    return new SupabaseFloorRepository(url, secretKey)
  }

  if (source !== "mock") {
    throw new Error(`Unknown DATA_SOURCE "${source}" (expected "mock" or "supabase").`)
  }

  return new InMemoryFloorRepository()
}

/** Test seam (T8): route handler tests inject a fresh in-memory repository
 * per test instead of depending on the module-level singleton or real env
 * vars. Not used outside tests. */
export function setFloorRepositoryForTests(repository: FloorRepository): void {
  ;(globalThis as GlobalWithRepo)[GLOBAL_KEY] = repository
}
