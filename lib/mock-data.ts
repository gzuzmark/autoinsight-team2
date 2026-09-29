export type Severidad = "parar" | "atencion" | "ok"
export type EstadoAlerta = "nueva" | "atendida" | "no_aplica"

export type Usuario = {
  id: string
  nombre: string
  pin: string
  iniciales: string
  color: string
}

/**
 * KPI reading (D24): `estado` is deliberately NOT a field here -- it is
 * always derived from `valor` + the threshold fields via
 * `lib/domain/indicadores.ts#estadoIndicador`, never stored independently,
 * so the state word can never drift from the reading that produced it.
 */
export type Indicador = {
  id: string
  nombre: string
  detalle: string
  valor: number
  unidad: string
  /** true = higher valor is better (e.g. FPY); false = lower is better
   * (e.g. Defectos/hora, Scrap). */
  mayorEsMejor: boolean
  umbralAtencion: number
  umbralParar: number
  actualizadoEn: number
}

export type Alerta = {
  id: string
  severidad: Severidad
  titulo: string
  estacion: string
  timestamp: number
  estado: EstadoAlerta
}

const AHORA = Date.now()
const min = (m: number) => AHORA - m * 60_000

export const PLANTA_NOMBRE = "Planta Norte"

// H2: every demo user shares PIN 1234 -- one PIN for the facilitator to
// remember while walking a guerrilla-testing participant through login,
// instead of a different PIN per avatar. Mock users carry no `linea` field
// (see the D19 note in floor-repository.ts): `iniciarSesion` only checks
// id+pin here, so this list never needs to track which line a user is "on".
export const USUARIOS: Usuario[] = [
  { id: "u1", nombre: "Ana Ríos", pin: "1234", iniciales: "AR", color: "#2563eb" },
  { id: "u2", nombre: "Beto Cruz", pin: "1234", iniciales: "BC", color: "#7c3aed" },
  { id: "u3", nombre: "Caro Díaz", pin: "1234", iniciales: "CD", color: "#0891b2" },
  { id: "u4", nombre: "Diego Mora", pin: "1234", iniciales: "DM", color: "#c026d3" },
  { id: "u5", nombre: "Eli Vega", pin: "1234", iniciales: "EV", color: "#ea580c" },
  { id: "u6", nombre: "Fer Luna", pin: "1234", iniciales: "FL", color: "#0d9488" },
  // H1: Línea 2 previously had no demo user, so alerts generated there by
  // "Simular turno" were never visible on any floor tablet.
  { id: "u7", nombre: "Gabi Paz", pin: "1234", iniciales: "GP", color: "#65a30d" },
]

// Thresholds match supabase/seed.sql's Línea 3 indicadores exactly (D24/D25):
// FPY is higher-is-better (atencion < 92, parar < 90); Defectos / hora and
// Scrap are lower-is-better (atencion/parar above their respective
// thresholds). The valor values below land in the same states as before
// (FPY parar, Defectos atencion, Scrap ok) -- see lib/domain/indicadores.ts.
export const INDICADORES: Indicador[] = [
  {
    id: "fpy",
    nombre: "FPY",
    detalle: "Rendimiento a primera pasada",
    valor: 88.4,
    unidad: "%",
    mayorEsMejor: true,
    umbralAtencion: 92,
    umbralParar: 90,
    actualizadoEn: AHORA,
  },
  {
    id: "dph",
    nombre: "Defectos / hora",
    detalle: "Umbral de atención 4–6",
    valor: 5,
    unidad: "defectos/h",
    mayorEsMejor: false,
    umbralAtencion: 4,
    umbralParar: 6,
    actualizadoEn: AHORA,
  },
  {
    id: "scrap",
    nombre: "Scrap",
    detalle: "Dentro del objetivo (≤ 2 %)",
    valor: 1.6,
    unidad: "%",
    mayorEsMejor: false,
    umbralAtencion: 2,
    umbralParar: 3,
    actualizadoEn: AHORA,
  },
]

export const ALERTAS_INICIALES: Alerta[] = [
  {
    id: "a1",
    severidad: "parar",
    titulo: "FPY por debajo del 90 %",
    estacion: "Estación 4 · Ensamble",
    timestamp: min(2),
    estado: "nueva",
  },
  {
    id: "a2",
    severidad: "parar",
    titulo: "Torque fuera de rango",
    estacion: "Estación 7 · Atornillado",
    timestamp: min(6),
    estado: "nueva",
  },
  {
    id: "a3",
    severidad: "atencion",
    titulo: "Defectos por hora en aumento",
    estacion: "Estación 2 · Soldadura",
    timestamp: min(11),
    estado: "nueva",
  },
  {
    id: "a4",
    severidad: "atencion",
    titulo: "Temperatura de horno alta",
    estacion: "Estación 5 · Curado",
    timestamp: min(18),
    estado: "nueva",
  },
  {
    id: "a5",
    severidad: "atencion",
    titulo: "Retrabajo sobre lo esperado",
    estacion: "Estación 3 · Inspección",
    timestamp: min(24),
    estado: "nueva",
  },
  {
    id: "a6",
    severidad: "ok",
    titulo: "Calibración completada",
    estacion: "Estación 1 · Recepción",
    timestamp: min(40),
    estado: "nueva",
  },
  {
    id: "a7",
    severidad: "ok",
    titulo: "Turno anterior sin scrap",
    estacion: "Línea completa",
    timestamp: min(55),
    estado: "nueva",
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

/**
 * Formats a timestamp as 24h HH:MM (e.g. "14:05") in the device's local time
 * zone. Uses `hourCycle: "h23"` explicitly (00-23, midnight as "00") instead
 * of only `hour12: false`: some ICU implementations render `hour12: false`
 * as the h24 cycle (01-24), which shows midnight as "24:00" instead of
 * "00:00" (F7).
 */
export function formatearHora(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
}

/** G6: "DD/MM/AAAA HH:MM" (es-AR, same h23 rationale as `formatearHora`) for
 * the shift-report email's subject line ("Reporte de turno — <línea> —
 * <fecha hora>"). */
export function formatearFechaHora(timestamp: number): string {
  const fecha = new Date(timestamp)
  const fechaStr = fecha.toLocaleDateString("es-AR")
  return `${fechaStr} ${formatearHora(timestamp)}`
}
