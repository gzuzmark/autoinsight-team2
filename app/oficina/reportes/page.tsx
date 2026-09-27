import { Download, FileText, MoreVertical, Plus } from "lucide-react"
import { OfficeShell } from "@/components/oficina/office-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { REPORTES, reporteVariante } from "@/lib/oficina/mock-data"

// Screen 03 (Reportes, O4): static report list plus a non-functional
// "Programar reporte" form (O-D4) -- inputs are plain, uncontrolled, and the
// submit button is type="button" so it never posts anywhere.
export default function ReportesPage() {
  const programados = REPORTES.filter((r) => r.estado === "Programado").length

  return (
    <OfficeShell pathname="/oficina/reportes" title="Reportes" subtitle="Genera, programa y exporta reportes de calidad">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Reportes</CardTitle>
              <CardDescription>
                {REPORTES.length} reportes · {programados} programados
              </CardDescription>
            </div>
            <button
              type="button"
              disabled
              className="flex items-center gap-2 rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-100"
            >
              <Plus className="size-4" aria-hidden />
              Nuevo reporte
            </button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {REPORTES.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
                    <FileText className="size-4" aria-hidden />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{r.nombre}</span>
                    <span className="text-xs text-muted-foreground">{r.detalle}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={reporteVariante(r.estado)}>{r.estado}</Badge>
                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-semibold disabled:opacity-100"
                  >
                    <Download className="size-3.5" aria-hidden />
                    Descargar
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-label="Más opciones"
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground disabled:opacity-100"
                  >
                    <MoreVertical className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Programar reporte</CardTitle>
            <CardDescription>Resumen diario de calidad</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3">
              <Campo etiqueta="Contenido" valor="FPY, defectos, scrap y alertas" />
              <Campo etiqueta="Alcance" valor="Planta Norte · todas las líneas" />
              <Campo etiqueta="Frecuencia" valor="Diario a las 07:00" />
              <Campo etiqueta="Formato" valor="PDF" />
              <Campo etiqueta="Enviar a" valor="calidad@planta-norte.com" tipo="email" />
              <button
                type="button"
                disabled
                className="mt-1 flex items-center justify-center rounded-md bg-indigo-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-100"
              >
                Guardar programación
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </OfficeShell>
  )
}

function Campo({ etiqueta, valor, tipo = "text" }: { etiqueta: string; valor: string; tipo?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{etiqueta}</span>
      <Input type={tipo} defaultValue={valor} disabled />
    </label>
  )
}
