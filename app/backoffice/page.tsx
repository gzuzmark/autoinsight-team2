import { cookies } from "next/headers"
import { BACKOFFICE_COOKIE_NAME } from "@/lib/api/backoffice-cookie"
import { decidirGate, isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
import { resolverEstadoDemo, type EstadoDemoFetchResult } from "@/lib/backoffice/estado-demo-fallback"
import { getFloorRepository } from "@/lib/floor-repository"
import { BackofficeDashboard } from "@/components/backoffice/backoffice-dashboard"
import { KeyGateForm } from "@/components/backoffice/key-gate-form"

// G1: /backoffice is deliberately NOT linked from '/', '/planta' or
// '/oficina' (D28 amendment, lib/backoffice/no-link-guard.test.ts). Server
// Component so the facilitator-key gate is decided server-side, before any
// dashboard content reaches the client: without a valid session cookie,
// only the key form ever renders. The actual "which view" decision is the
// pure, unit-tested `decidirGate` (B3, RDD review 2026-09-28,
// lib/backoffice/key-gate.test.ts) -- this component only gathers its
// inputs and renders the result.
//
// G2: "Estado de la demo" reads live data straight from FloorRepository
// here (no separate GET route needed) -- every mutating action
// (Reiniciar demo / Simular turno / Escenarios) calls `router.refresh()` on
// success, which re-runs this Server Component and hands
// BackofficeDashboard fresh props.
//
// C4 (RDD review G2, 2026-09-28): `estadoDemo()` used to be awaited directly
// in the JSX below -- a Supabase outage there crashed this whole Server
// Component render, taking "Reiniciar demo" (the facilitator's recovery
// path) down with it. It is now wrapped in try/catch and the decision of
// what to render is the pure, unit-tested `resolverEstadoDemo`
// (lib/backoffice/estado-demo-fallback.ts): on failure, the dashboard still
// renders with a usable placeholder and an inline error.
export default async function BackofficePage() {
  const configured = isBackofficeConfigured()
  const jar = await cookies()
  const token = jar.get(BACKOFFICE_COOKIE_NAME)?.value ?? null
  const decision = decidirGate(configured, isValidToken(token))

  let resultado: EstadoDemoFetchResult | null = null
  if (decision === "dashboard") {
    try {
      resultado = { ok: true, data: await getFloorRepository().estadoDemo() }
    } catch (err) {
      // D4 (final-demo plan Batch I): log the underlying failure
      // server-side (no secrets -- `err` here is a repository-mapped
      // Error, never a raw Supabase/PostgREST payload with credentials) so
      // an outage or a missing/un-applied migration is diagnosable instead
      // of only ever showing the generic banner below.
      console.error("[backoffice] estadoDemo() failed:", err)
      resultado = { ok: false, error: "No se pudo obtener el estado de la demo." }
    }
  }

  return (
    <main className="min-h-dvh w-full bg-neutral-50 px-4 py-6 text-neutral-900 md:px-8">
      {decision === "dashboard" && resultado ? (
        <BackofficeDashboard {...resolverEstadoDemo(resultado)} />
      ) : (
        <KeyGateForm configured={decision !== "disabled"} />
      )}
    </main>
  )
}
