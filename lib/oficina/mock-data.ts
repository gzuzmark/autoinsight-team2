// Static data for the office desk view (O-D4): no API calls, everything the
// office screens render lives in this one module. Unlike the plant-floor
// tablet (D5: no numeric KPI values), the office view is read at a desk and
// shows real numbers, trends and comparisons.

export type EstadoUmbral = "ok" | "atencion" | "parar"

/** FPY 30-day bar color by threshold: >=92% on objective, 90-92% atención,
 * below 90% parar (mirrors the plant-floor OK/ATENCIÓN/PARAR thresholds). */
export function fpyBarEstado(fpy: number): EstadoUmbral {
  if (fpy >= 92) return "ok"
  if (fpy >= 90) return "atencion"
  return "parar"
}

export type BucketAlertas = "0" | "1-2" | "3-5" | "6+"

/** Line x station heatmap bucket for a 7-day alert count. */
export function heatmapBucket(cantidad: number): BucketAlertas {
  if (cantidad < 0) throw new Error(`heatmapBucket: cantidad must be >= 0, got ${cantidad}`)
  if (cantidad === 0) return "0"
  if (cantidad <= 2) return "1-2"
  if (cantidad <= 5) return "3-5"
  return "6+"
}

export type Kpi = {
  id: string
  nombre: string
  valor: string
  delta: string
  tendencia: "up" | "down"
  favorable: boolean
  nota?: string
}

export const KPIS: Kpi[] = [
  { id: "fpy", nombre: "FPY planta", valor: "90,6 %", delta: "-1,8 pp", tendencia: "down", favorable: false, nota: "vs. período anterior" },
  { id: "defectos", nombre: "Defectos / hora", valor: "4,3", delta: "+0,9", tendencia: "up", favorable: false, nota: "vs. período anterior" },
  { id: "scrap", nombre: "Scrap", valor: "1,9 %", delta: "-0,3 pp", tendencia: "down", favorable: true, nota: "vs. período anterior" },
  { id: "alertas", nombre: "Alertas abiertas", valor: "17", delta: "+5", tendencia: "up", favorable: false, nota: "7 de gravedad ALTA" },
  { id: "atencion", nombre: "Tiempo medio de atención", valor: "23 min", delta: "-6 min", tendencia: "down", favorable: true, nota: "objetivo 30 min" },
]

export type PuntoFpy = { dia: number; fpy: number }

/** 30 days of hand-authored FPY for Línea 3: a realistic mix across all
 * three thresholds (roughly half ok, a third atención, the rest parar),
 * closing on a short run of parar days -- mirrors the mockup's mixed
 * blue/orange/red bars rather than an almost-all-red trend. */
const FPY_VALORES: number[] = [
  95, 93, 96, 91, 94, 97, 90, 88, 93, 95, 92, 91, 96, 94, 90, 93, 89, 95, 91,
  97, 94, 92, 90, 93, 91, 88, 88, 87, 85, 83,
]

export const FPY_TENDENCIA: PuntoFpy[] = FPY_VALORES.map((fpy, i) => ({ dia: i + 1, fpy }))

/** Maps FPY onto a visible chart bar height: the 80-100% range (where all
 * three thresholds live) is stretched onto 15-100% of the chart, so bars
 * stay clearly readable instead of nearly flat when FPY only varies by a
 * few points. Values outside 80-100 are clamped to the nearest end. */
export function fpyBarHeightPercent(fpy: number): number {
  const MIN_FPY = 80
  const MAX_FPY = 100
  const MIN_HEIGHT = 15
  const MAX_HEIGHT = 100
  const acotado = Math.min(MAX_FPY, Math.max(MIN_FPY, fpy))
  return MIN_HEIGHT + ((acotado - MIN_FPY) / (MAX_FPY - MIN_FPY)) * (MAX_HEIGHT - MIN_HEIGHT)
}

export type DefectoPareto = { causa: string; cantidad: number; porcentajeAcumulado: number }

const CAUSAS_PARETO: { causa: string; cantidad: number }[] = [
  { causa: "Torque fuera de rango", cantidad: 142 },
  { causa: "Fuga de aire", cantidad: 96 },
  { causa: "Soldadura porosa", cantidad: 71 },
  { causa: "Pintura con grumos", cantidad: 48 },
  { causa: "Sensor sin respuesta", cantidad: 33 },
  { causa: "Otros", cantidad: 68 },
]

const TOTAL_DEFECTOS = CAUSAS_PARETO.reduce((acc, c) => acc + c.cantidad, 0)

export const PARETO_DEFECTOS: DefectoPareto[] = (() => {
  let acumulado = 0
  return CAUSAS_PARETO.map((c) => {
    acumulado += c.cantidad
    return { ...c, porcentajeAcumulado: Math.round((acumulado / TOTAL_DEFECTOS) * 100) }
  })
})()

export const TOTAL_DEFECTOS_PARETO = TOTAL_DEFECTOS

export type FilaHeatmap = { linea: string; conteos: number[] }

export const ESTACIONES_HEATMAP = ["E1", "E2", "E3", "E4", "E5", "E6", "E7"]

export const HEATMAP_ALERTAS: FilaHeatmap[] = [
  { linea: "Línea 1 · Chasis", conteos: [1, 1, 1, 4, 1, 1, 1] },
  { linea: "Línea 2 · Pintura", conteos: [1, 1, 4, 1, 1, 1, 1] },
  { linea: "Línea 3 · Motores", conteos: [1, 1, 4, 3, 6, 6, 6] },
]

export type Severidad = "ALTA" | "MEDIA" | "BAJA"
export type EstadoAlerta = "Nueva" | "Atendida" | "No aplica"

export type EventoHistorial = {
  hora: string
  titulo: string
  detalle: string
  estado: EstadoUmbral | "info"
}

/** F2: an alert's chart breach direction. "arriba" = a value above the limit
 * is the breach (torque, defects/hour, scrap); "abajo" = a value below the
 * limit is the breach (FPY, or any target-minimum metric). */
export type DireccionLimite = "arriba" | "abajo"

/** F2: metric metadata for the alert's chart -- title, unit, limit and
 * breach direction -- so the chart is driven by the alert's own metric
 * instead of a fixed "torque in Nm, above limit" assumption. */
export type MetricaAlerta = {
  titulo: string
  unidad: string
  limite: number
  direccion: DireccionLimite
  serie: number[]
}

/** F2: whether a single measurement breaches its limit, direction-aware. A
 * value exactly at the limit is never a breach in either direction. */
export function barraFueraDeLimite(valor: number, limite: number, direccion: DireccionLimite): boolean {
  return direccion === "arriba" ? valor > limite : valor < limite
}

export type AlertaOficina = {
  id: string
  gravedad: Severidad
  titulo: string
  linea: string
  estacion: string
  lineaEstacion: string
  valorLimite: string
  turno: string
  estado: EstadoAlerta
  hace: string
  metrica: MetricaAlerta
  historial: EventoHistorial[]
  ocho_d: { paso: string; completado: boolean }[]
  ocho_d_progreso: string
}

export const ALERTAS: AlertaOficina[] = [
  {
    id: "torque-fuera-de-rango-l3-e7",
    gravedad: "ALTA",
    titulo: "Torque fuera de rango",
    linea: "Línea 3 · Motores",
    estacion: "E7 · Atornillado",
    lineaEstacion: "L3 - E7 Atornillado",
    valorLimite: "12,5 Nm / 10 Nm",
    turno: "Mañana",
    estado: "Nueva",
    hace: "2 min",
    metrica: {
      titulo: "Torque en E7",
      unidad: "Nm",
      limite: 10,
      direccion: "arriba",
      serie: [8.1, 8.4, 8.9, 9.2, 10.3, 10.8, 11.6, 12.5],
    },
    historial: [
      { hora: "08:12", titulo: "Alerta creada automáticamente", detalle: "Torque 12,5 Nm supera el límite de 10 Nm", estado: "parar" },
      { hora: "08:15", titulo: "Vista por Ana Ríos en planta", detalle: "Desde la tablet de la Línea 3", estado: "info" },
      { hora: "08:31", titulo: "Marcada como Atendida", detalle: "Ana Ríos · 19 min después", estado: "ok" },
      { hora: "09:02", titulo: "Se repite en la misma estación", detalle: "3.ª vez en 7 días · sugerido abrir 8D", estado: "atencion" },
    ],
    ocho_d: [
      { paso: "D1 Equipo definido", completado: true },
      { paso: "D2 Problema descrito", completado: true },
      { paso: "D3 Contención: revisión 100 % en E7", completado: true },
      { paso: "D4 Causa raíz: desgaste de herramienta", completado: false },
      { paso: "D5-D8 Acciones y cierre", completado: false },
    ],
    ocho_d_progreso: "40 % completado",
  },
  {
    id: "fpy-por-debajo-l3-e4",
    gravedad: "ALTA",
    titulo: "FPY por debajo del objetivo",
    linea: "Línea 3 · Motores",
    estacion: "E4 · Ensamble",
    lineaEstacion: "L3 - E4 Ensamble",
    valorLimite: "87,2 % / 92 %",
    turno: "Mañana",
    estado: "Nueva",
    hace: "5 min",
    metrica: {
      titulo: "FPY en E4",
      unidad: "%",
      limite: 92,
      direccion: "abajo",
      serie: [90, 89, 88.5, 88, 87.8, 87.5, 87.3, 87.2],
    },
    historial: [
      { hora: "07:50", titulo: "Alerta creada automáticamente", detalle: "FPY 87,2 % por debajo del objetivo de 92 %", estado: "parar" },
    ],
    ocho_d: [
      { paso: "D1 Equipo definido", completado: false },
      { paso: "D2 Problema descrito", completado: false },
      { paso: "D3 Contención: revisión 100 % en E7", completado: false },
      { paso: "D4 Causa raíz: desgaste de herramienta", completado: false },
      { paso: "D5-D8 Acciones y cierre", completado: false },
    ],
    ocho_d_progreso: "0 % completado",
  },
  {
    id: "defectos-por-hora-l3-e2",
    gravedad: "MEDIA",
    titulo: "Defectos por hora en aumento",
    linea: "Línea 3 · Motores",
    estacion: "E2 · Soldadura",
    lineaEstacion: "L3 - E2 Soldadura",
    valorLimite: "6,1 / hora / 4 / hora",
    turno: "Mañana",
    estado: "Atendida",
    hace: "18 min",
    metrica: {
      titulo: "Defectos por hora en E2",
      unidad: "defectos/h",
      limite: 4,
      direccion: "arriba",
      serie: [4, 4.2, 4.6, 5, 5.4, 5.8, 6, 6.1],
    },
    historial: [
      { hora: "07:20", titulo: "Alerta creada automáticamente", detalle: "Defectos 6,1/hora supera el límite de 4/hora", estado: "parar" },
      { hora: "07:38", titulo: "Marcada como Atendida", detalle: "Beto Cruz · 18 min después", estado: "ok" },
    ],
    ocho_d: [],
    ocho_d_progreso: "0 % completado",
  },
  {
    id: "scrap-por-encima-l2-e3",
    gravedad: "MEDIA",
    titulo: "Scrap por encima del objetivo",
    linea: "Línea 2 · Pintura",
    estacion: "E3 · Retrabajo",
    lineaEstacion: "L2 - E3 Retrabajo",
    valorLimite: "2,8 % / 2 %",
    turno: "Mañana",
    estado: "Nueva",
    hace: "41 min",
    metrica: {
      titulo: "Scrap en E3",
      unidad: "%",
      limite: 2,
      direccion: "arriba",
      serie: [2, 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8],
    },
    historial: [
      { hora: "06:41", titulo: "Alerta creada automáticamente", detalle: "Scrap 2,8 % supera el objetivo de 2 %", estado: "parar" },
    ],
    ocho_d: [],
    ocho_d_progreso: "0 % completado",
  },
]

export function getAlertaPorId(id: string): AlertaOficina | undefined {
  return ALERTAS.find((a) => a.id === id)
}

/** F3: severity -> badge variant, shared by the latest-alerts table and the
 * alert investigation page so the same alert never shows a different
 * severity color on the two screens. */
export type VarianteGravedad = "destructive" | "default" | "secondary"

export const VARIANTE_POR_GRAVEDAD: Record<Severidad, VarianteGravedad> = {
  ALTA: "destructive",
  MEDIA: "default",
  BAJA: "secondary",
}

export type EstadoReporte = "Programado" | "Manual" | "Pausado"
export type VarianteBadge = "default" | "secondary" | "outline" | "destructive"

/** Report status -> badge variant. */
export function reporteVariante(estado: EstadoReporte): VarianteBadge {
  switch (estado) {
    case "Programado":
      return "default"
    case "Manual":
      return "secondary"
    case "Pausado":
      return "outline"
  }
}

export type Reporte = {
  id: string
  nombre: string
  detalle: string
  estado: EstadoReporte
}

export const REPORTES: Reporte[] = [
  { id: "resumen-diario-calidad", nombre: "Resumen diario de calidad", detalle: "Todos los días 07:00 · PDF · 12 destinatarios", estado: "Programado" },
  { id: "pareto-semanal-defectos", nombre: "Pareto semanal de defectos", detalle: "Lunes 08:00 · Excel · Calidad y garantías", estado: "Programado" },
  { id: "garantias-reclamos-mes", nombre: "Garantías y reclamos del mes", detalle: "Día 1 · PDF · Dirección", estado: "Programado" },
  { id: "tiempo-atencion-turno", nombre: "Tiempo de atención por turno", detalle: "Bajo demanda · Excel", estado: "Manual" },
  { id: "auditoria-alertas-no-aplica", nombre: "Auditoría de alertas No aplica", detalle: "Viernes 17:00 · PDF · Jefes de planta", estado: "Pausado" },
]
