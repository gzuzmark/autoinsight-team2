import { cookies } from "next/headers"
import { BACKOFFICE_COOKIE_NAME } from "@/lib/api/backoffice-cookie"
import { decidirGate, isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
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
// (Reiniciar demo / Simular turno) calls `router.refresh()` on success,
// which re-runs this Server Component and hands BackofficeDashboard fresh
// props.
export default async function BackofficePage() {
  const configured = isBackofficeConfigured()
  const jar = await cookies()
  const token = jar.get(BACKOFFICE_COOKIE_NAME)?.value ?? null
  const decision = decidirGate(configured, isValidToken(token))

  return (
    <main className="min-h-dvh w-full bg-neutral-50 px-4 py-6 text-neutral-900 md:px-8">
      {decision === "dashboard" ? (
        <BackofficeDashboard estadoDemo={await getFloorRepository().estadoDemo()} />
      ) : (
        <KeyGateForm configured={decision !== "disabled"} />
      )}
    </main>
  )
}
