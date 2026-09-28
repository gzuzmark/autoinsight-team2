import { cookies } from "next/headers"
import { BACKOFFICE_COOKIE_NAME } from "@/lib/api/backoffice-cookie"
import { isBackofficeConfigured, isValidToken } from "@/lib/backoffice/key-gate"
import { BackofficeDashboard } from "@/components/backoffice/backoffice-dashboard"
import { KeyGateForm } from "@/components/backoffice/key-gate-form"

// G1: /backoffice is deliberately NOT linked from '/', '/planta' or
// '/oficina' (D28 amendment, lib/backoffice/no-link-guard.test.ts). Server
// Component so the facilitator-key gate is decided server-side, before any
// dashboard content reaches the client: without a valid session cookie,
// only the key form ever renders.
export default async function BackofficePage() {
  const configured = isBackofficeConfigured()
  const jar = await cookies()
  const token = jar.get(BACKOFFICE_COOKIE_NAME)?.value ?? null
  const authenticated = configured && isValidToken(token)

  return (
    <main className="min-h-dvh w-full bg-neutral-50 px-4 py-6 text-neutral-900 md:px-8">
      {authenticated ? <BackofficeDashboard /> : <KeyGateForm configured={configured} />}
    </main>
  )
}
