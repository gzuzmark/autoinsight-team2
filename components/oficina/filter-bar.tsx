import { Download, LayoutGrid } from "lucide-react"

// Non-functional filter bar (static demo, O-D4): plain disabled selects, no
// client interactivity needed for a screen that never calls an API.
function FiltroEstatico({ label, valor }: { label: string; valor: string }) {
  return (
    <label className="flex items-center gap-1 text-sm text-neutral-700">
      {label && <span className="text-muted-foreground">{label}</span>}
      <select disabled defaultValue={valor} className="rounded-md border border-input bg-background px-2 py-1 text-sm disabled:opacity-100">
        <option>{valor}</option>
      </select>
    </label>
  )
}

export function FilterBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1 text-sm font-medium text-neutral-700">
          <LayoutGrid className="size-4" aria-hidden />
        </span>
        <FiltroEstatico label="" valor="Planta Norte" />
        <FiltroEstatico label="" valor="Todas las líneas" />
        <FiltroEstatico label="Turno:" valor="todos" />
        <FiltroEstatico label="" valor="Últimos 30 días" />
        <FiltroEstatico label="" valor="vs. 30 días anteriores" />
      </div>
      <button
        type="button"
        disabled
        className="flex items-center gap-2 rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-100"
      >
        <Download className="size-4" aria-hidden />
        Exportar
      </button>
    </div>
  )
}
