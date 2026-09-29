// G8: PostHog client-side init (Next 16's `instrumentation-client.ts`
// convention -- runs after the HTML document loads, before hydration; see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
// instrumentation-client.md). `inicializarPosthog` itself no-ops when
// NEXT_PUBLIC_POSTHOG_KEY is unset (tests, local dev without a key, CI).
//
// `/backoffice` (the facilitator tool, not a guerrilla-testing participant)
// must never be recorded or analyzed -- skipped entirely here, so no
// PostHog script/session ever starts on that route.
import { inicializarPosthog } from "@/lib/analytics/posthog-client"

if (typeof window !== "undefined" && !window.location.pathname.startsWith("/backoffice")) {
  inicializarPosthog({
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  })
}
