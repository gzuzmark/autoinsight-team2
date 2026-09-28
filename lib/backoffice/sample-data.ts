/**
 * Static sample data for the /backoffice facilitator dashboard. G2 wired
 * "Estado de la demo" and "Cambiar turno" to live FloorRepository data
 * (see app/backoffice/page.tsx / components/backoffice/backoffice-dashboard.tsx)
 * -- everything below stays inert until its own task (G3 Escenarios, G6/G7
 * Comunicaciones, G4 Registro, G5 Guion y notas / Participante).
 */

export const PLANTA_NOMBRE = "Planta Norte"

/** G2: "Participante actual" stays a placeholder until G4/G5 wire real
 * session-log participant tracking; "Nuevo participante" stays inert. */
export const PARTICIPANTE_ACTUAL = "P3"

// G3: the real scenario catalog (ids + labels) now lives in
// lib/domain/escenarios.ts, shared with the Supabase migration/route --
// "Escenarios" wires to it directly in backoffice-dashboard.tsx.

export type ComunicacionAccion = { id: string; etiqueta: string; detalle: string }

export const COMUNICACIONES: ComunicacionAccion[] = [
  { id: "correo", etiqueta: "Enviar correo ahora", detalle: "Destinatario: calidad@planta-norte.com" },
  { id: "push", etiqueta: "Disparar push", detalle: "Destino: Oficina · severidad ALTA" },
]

export type EventoSesion = {
  hora: string
  participante: string
  evento: string
  tiempoDesdeMostrada: string
}

export const REGISTRO_SESION: EventoSesion[] = [
  { hora: "08:12:03", participante: "P3", evento: "Alerta mostrada", tiempoDesdeMostrada: "—" },
  { hora: "08:12:07", participante: "P3", evento: "Abierta", tiempoDesdeMostrada: "4,2 s" },
  { hora: "08:12:22", participante: "P3", evento: "Atendida", tiempoDesdeMostrada: "19,1 s" },
]

export const GUION_PASOS: string[] = [
  "¿Cómo está tu línea?",
  "Atiende la alerta más grave",
  "Tras el cambio de turno, ¿qué cambió?",
]
