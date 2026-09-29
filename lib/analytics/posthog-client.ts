"use client"

import posthog from "posthog-js"

/**
 * G8: thin, guarded wrapper around posthog-js. Every export below is a
 * no-op until `inicializarPosthog` has actually run with a real key --
 * this is the module-level "init guard" that makes analytics a true no-op
 * in tests, local dev without a key configured, and CI (NEXT_PUBLIC_POSTHOG_KEY
 * unset everywhere except real deployments).
 *
 * Never imported by a Server Component: PostHog only runs in the browser,
 * initialized once from `instrumentation-client.ts` (Next 16's client-side
 * instrumentation convention -- see node_modules/next/dist/docs/01-app/
 * 03-api-reference/03-file-conventions/instrumentation-client.md).
 */

let inicializado = false

export type OpcionesInicializarPosthog = {
  key: string | undefined
  host: string | undefined
}

/**
 * Autocapture OFF (explicit events only -- lib/analytics/events.ts is the
 * single source of what gets sent), `person_profiles: "identified_only"`
 * (no profile for a visitor who never logs in -- e.g. a stray /backoffice
 * hit that somehow reaches this far), inputs masked in session replay by
 * default (PIN pad also carries `ph-no-capture`, belt and suspenders --
 * see components/pin-pad.tsx). No autocaptured pageviews either: every
 * screen transition worth measuring already has its own explicit event
 * (login, alerta_*, oficina_alerta_abierta, ...).
 *
 * A missing key (mock/test/CI/local without one configured, the default)
 * is a deliberate no-op, not an error -- the whole module stays inert.
 */
export function inicializarPosthog({ key, host }: OpcionesInicializarPosthog): void {
  if (!key || inicializado) return
  posthog.init(key, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    person_profiles: "identified_only",
    session_recording: { maskAllInputs: true },
  })
  inicializado = true
}

export function posthogInicializado(): boolean {
  return inicializado
}

export type EventoAnalitica = { name: string; properties?: Record<string, unknown> }

export function capturarEvento(evento: EventoAnalitica): void {
  if (!inicializado) return
  posthog.capture(evento.name, evento.properties)
}

/** Called right after floor login with the current participant number
 * ("P<n>", Tablero#participante) -- ties every subsequent event to that
 * guerrilla-testing participant, and re-identifies again if the number
 * changes mid-session (a facilitator "Nuevo participante" during someone
 * else's session, polled -- see components/app-provider.tsx). */
export function identificarParticipante(participanteId: string, propiedades?: Record<string, unknown>): void {
  if (!inicializado) return
  posthog.identify(participanteId, propiedades)
}

/** Logout: clears the PostHog distinct id / session so the NEXT login (or
 * the next participant) never gets attributed to the previous one. */
export function reiniciarIdentidad(): void {
  if (!inicializado) return
  posthog.reset()
}

/** `/backoffice` must never be recorded (facilitator tool, not a
 * guerrilla-testing participant) -- instrumentation-client.ts skips
 * `inicializarPosthog` entirely there, but this is also called defensively
 * if a route ever needs to stop an in-flight recording. */
export function detenerGrabacionSesion(): void {
  if (!inicializado) return
  posthog.stopSessionRecording()
}
