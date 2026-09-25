export type Severidad = "parar" | "atencion" | "ok"
export type EstadoAlerta = "nueva" | "atendida"
export type Feedback = "util" | "no_util" | null

export type Usuario = {
  id: string
  nombre: string
  pin: string
  iniciales: string
  color: string
}

export type Indicador = {
  id: string
  nombre: string
  valor: string
  detalle: string
  estado: Severidad
}

export type Alerta = {
  id: string
  severidad: Severidad
  titulo: string
  estacion: string
  timestamp: number
  estado: EstadoAlerta
  feedback: Feedback
}

const AHORA = Date.now()
const min = (m: number) => AHORA - m * 60_000

export const USUARIOS: Usuario[] = [
  { id: "u1", nombre: "Ana Ríos", pin: "1234", iniciales: "AR", color: "#2563eb" },
  { id: "u2", nombre: "Beto Cruz", pin: "2468", iniciales: "BC", color: "#7c3aed" },
  { id: "u3", nombre: "Caro Díaz", pin: "1357", iniciales: "CD", color: "#0891b2" },
  { id: "u4", nombre: "Diego Mora", pin: "9753", iniciales: "DM", color: "#c026d3" },
  { id: "u5", nombre: "Eli Vega", pin: "4321", iniciales: "EV", color: "#ea580c" },
  { id: "u6", nombre: "Fer Luna", pin: "8642", iniciales: "FL", color: "#0d9488" },
]

export const INDICADORES: Indicador[] = [
  { id: "fpy", nombre: "FPY", valor: "88.4 %", detalle: "Rendimiento a primera pasada", estado: "parar" },
  { id: "dph", nombre: "Defectos / hora", valor: "5", detalle: "Umbral de atención 4–6", estado: "atencion" },
  { id: "scrap", nombre: "Scrap", valor: "1.6 %", detalle: "Dentro del objetivo (≤ 2 %)", estado: "ok" },
]

export const ALERTAS_INICIALES: Alerta[] = [
  {
    id: "a1",
    severidad: "parar",
    titulo: "FPY por debajo del 90 %",
    estacion: "Estación 4 · Ensamble",
    timestamp: min(2),
    estado: "nueva",
    feedback: null,
  },
  {
    id: "a2",
    severidad: "parar",
    titulo: "Torque fuera de rango",
    estacion: "Estación 7 · Atornillado",
    timestamp: min(6),
    estado: "nueva",
    feedback: null,
  },
  {
    id: "a3",
    severidad: "atencion",
    titulo: "Defectos por hora en aumento",
    estacion: "Estación 2 · Soldadura",
    timestamp: min(11),
    estado: "nueva",
    feedback: null,
  },
  {
    id: "a4",
    severidad: "atencion",
    titulo: "Temperatura de horno alta",
    estacion: "Estación 5 · Curado",
    timestamp: min(18),
    estado: "nueva",
    feedback: null,
  },
  {
    id: "a5",
    severidad: "atencion",
    titulo: "Retrabajo sobre lo esperado",
    estacion: "Estación 3 · Inspección",
    timestamp: min(24),
    estado: "nueva",
    feedback: null,
  },
  {
    id: "a6",
    severidad: "ok",
    titulo: "Calibración completada",
    estacion: "Estación 1 · Recepción",
    timestamp: min(40),
    estado: "nueva",
    feedback: null,
  },
  {
    id: "a7",
    severidad: "ok",
    titulo: "Turno anterior sin scrap",
    estacion: "Línea completa",
    timestamp: min(55),
    estado: "nueva",
    feedback: null,
  },
]

// Alertas que entran al "simular cambio de turno".
export const ALERTAS_NUEVO_TURNO: Alerta[] = [
  {
    id: "n1",
    severidad: "parar",
    titulo: "Paro de línea por fuga de aire",
    estacion: "Estación 6 · Neumática",
    timestamp: min(0),
    estado: "nueva",
    feedback: null,
  },
  {
    id: "n2",
    severidad: "atencion",
    titulo: "Nivel de adhesivo bajo",
    estacion: "Estación 5 · Curado",
    timestamp: min(1),
    estado: "nueva",
    feedback: null,
  },
]

// Sorting now lives in lib/domain/alerts.ts (pure domain module); re-exported
// here under the existing name so current imports keep working unchanged.
export { sortAlerts as ordenarAlertas } from "./domain/alerts"

export function haceCuanto(timestamp: number): string {
  const segundos = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (segundos < 60) return "hace un momento"
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  return `hace ${horas} h`
}
