import type { Severidad } from "@/lib/mock-data"

/**
 * Static sample data for the /backoffice facilitator dashboard (G1). Every
 * action shown against this data is inert in G1 -- the real behavior
 * (reset, shift trigger, scenarios, comms) ships in G2/G3/G6/G7. Line names
 * and layout match the OpenPencil design (odd/tasks/assets/shot-backoffice.png).
 */

export type LineaDemo = {
  id: string
  nombre: string
  estado: Severidad
  ultimaSimulacion: string | null
}

export const PLANTA_NOMBRE = "Planta Norte"

export const LINEAS_DEMO: LineaDemo[] = [
  { id: "linea-1", nombre: "Línea 1 · Chasis", estado: "ok", ultimaSimulacion: null },
  { id: "linea-2", nombre: "Línea 2 · Pintura", estado: "atencion", ultimaSimulacion: "08:15" },
  { id: "linea-3", nombre: "Línea 3 · Motores", estado: "parar", ultimaSimulacion: null },
]

export const ESTADO_DEMO = {
  alertasAbiertas: 4,
  ultimoTurno: "06:00",
  participanteActual: "P3",
}

export type Escenario = { id: string; nombre: string; activo: boolean }

export const ESCENARIOS: Escenario[] = [
  { id: "todo-ok", nombre: "Todo OK", activo: true },
  { id: "linea-3-parar-alta", nombre: "Línea 3 en PARAR con 1 ALTA", activo: false },
  { id: "muchas-alertas-media", nombre: "Muchas alertas MEDIA", activo: false },
  { id: "recuperacion-turno", nombre: "Recuperación tras turno", activo: false },
]

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
