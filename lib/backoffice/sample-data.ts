/**
 * Static sample data for the /backoffice facilitator dashboard. G2 wired
 * "Estado de la demo" and "Cambiar turno" to live FloorRepository data
 * (see app/backoffice/page.tsx / components/backoffice/backoffice-dashboard.tsx)
 * -- everything below stays inert until its own task (G5 Guion y notas).
 */

export const PLANTA_NOMBRE = "Planta Norte"

// G3: the real scenario catalog (ids + labels) now lives in
// lib/domain/escenarios.ts, shared with the Supabase migration/route --
// "Escenarios" wires to it directly in backoffice-dashboard.tsx.

// G6: "Enviar correo ahora" and the "Enviar reporte al simular turno"
// toggle are wired to live data/routes directly in
// backoffice-dashboard.tsx (EstadoDemo#enviarReporteTurno,
// POST /api/backoffice/correo, POST /api/backoffice/configuracion).
// G7b: "Disparar push" is wired too (POST /api/backoffice/push).

// G8 (G4 folded in, "Decisions" 2026-09-28): "Participante actual" and
// "Nuevo participante" are wired to live data/routes directly in
// backoffice-dashboard.tsx (EstadoDemo#participanteActual,
// POST /api/backoffice/participante). "Registro de la sesión" no longer
// holds sample rows -- session events go ONLY to PostHog now (no Supabase
// event table, no CSV export); the card is a link to
// NEXT_PUBLIC_POSTHOG_PROJECT_URL.

export const GUION_PASOS: string[] = [
  "¿Cómo está tu línea?",
  "Atiende la alerta más grave",
  "Tras el cambio de turno, ¿qué cambió?",
]
