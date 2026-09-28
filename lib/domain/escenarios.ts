/**
 * G3: the fixed catalog of predefined back-office scenarios (id + label),
 * shared by every layer that needs to know the set exists -- the
 * `FloorRepository` port, both adapters, the `/api/backoffice/escenario`
 * route, and the "Escenarios" dashboard card -- so no layer can drift from
 * another's spelling of an id. Mirrors the Supabase migration's
 * `check (p_escenario in (...))` list exactly (see
 * `supabase/migrations/20260928000022_demo_escenarios.sql`).
 */
export const ESCENARIO_IDS = ["todo-ok", "linea3-parar-alta", "muchas-media", "recuperacion"] as const

export type EscenarioId = (typeof ESCENARIO_IDS)[number]

export function esEscenarioId(valor: unknown): valor is EscenarioId {
  return typeof valor === "string" && (ESCENARIO_IDS as readonly string[]).includes(valor)
}

export type EscenarioCatalogo = { id: EscenarioId; nombre: string }

export const ESCENARIOS: EscenarioCatalogo[] = [
  { id: "todo-ok", nombre: "Todo OK" },
  { id: "linea3-parar-alta", nombre: "Línea 3 en PARAR con 1 ALTA" },
  { id: "muchas-media", nombre: "Muchas alertas MEDIA" },
  { id: "recuperacion", nombre: "Recuperación tras turno" },
]
