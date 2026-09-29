import Link from "next/link"
import { notFound } from "next/navigation"
import { ClipboardList, UserPlus } from "lucide-react"
import { OfficeShell } from "@/components/oficina/office-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MetricChart } from "@/components/oficina/metric-chart"
import { AlertHistory } from "@/components/oficina/alert-history"
import { EightDPanel } from "@/components/oficina/eight-d-panel"
import { getAlertaPorId, VARIANTE_POR_GRAVEDAD, type AlertaOficina } from "@/lib/oficina/mock-data"
import { alertaDetalleAOficina } from "@/lib/oficina/alerta-real"
import { getFloorRepository } from "@/lib/floor-repository"
import { CapturaAperturaAlerta } from "@/components/oficina/captura-apertura-alerta"

// Screen 02 (Investigación de alerta, O3). G7b: a real alert id (from the
// floor repository -- Supabase in prod, InMemory in mock mode) is preferred
// first; the static samples (lib/oficina/mock-data.ts, still linked from
// the Resumen table) keep working for their own sample ids. An id that
// matches neither renders the not-found boundary.
//
// Next 16 passes route params as a Promise (breaking change vs. earlier
// versions) -- see node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md.
export default async function AlertaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ origen?: string }>
}) {
  const { id } = await params
  const { origen } = await searchParams
  const alerta = await resolverAlerta(id)
  if (!alerta) notFound()

  return (
    <OfficeShell pathname="/oficina/alertas" title="Investigación de alerta" subtitle={`Alertas › ${alerta.linea} › ${alerta.titulo}`}>
      <CapturaAperturaAlerta alertaId={alerta.id} origenPush={origen === "push"} />
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          <Link href="/oficina" className="hover:underline">
            Resumen
          </Link>
          {" › "}
          <Link href="/oficina" className="hover:underline">
            Alertas
          </Link>
          {" › "}
          {alerta.linea} · {alerta.titulo}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge variant={VARIANTE_POR_GRAVEDAD[alerta.gravedad]}>{alerta.gravedad}</Badge>
            <h2 className="text-xl font-bold">{alerta.titulo}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-semibold disabled:opacity-100"
            >
              <ClipboardList className="size-4" aria-hidden />
              Abrir análisis 8D
            </button>
            <button
              type="button"
              disabled
              className="flex items-center gap-2 rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-100"
            >
              <UserPlus className="size-4" aria-hidden />
              Asignar
            </button>
          </div>
        </div>

        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4">
            <Hecho etiqueta="Línea" valor={alerta.linea} />
            <Hecho etiqueta="Estación" valor={alerta.estacion} />
            <Hecho etiqueta="Valor / límite" valor={alerta.valorLimite} />
            <Hecho etiqueta="Turno" valor={alerta.turno} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {alerta.metrica.titulo} · últimas 8 horas
                {alerta.esReal && <Badge variant="outline">Ejemplo</Badge>}
              </CardTitle>
              <CardDescription>
                {alerta.esReal
                  ? "Sin serie histórica para esta alerta todavía -- gráfico de ejemplo."
                  : <>
                      Cada barra es una medición · rojo ={" "}
                      {alerta.metrica.direccion === "arriba"
                        ? `sobre el límite de ${alerta.metrica.limite} ${alerta.metrica.unidad}`
                        : `bajo el objetivo de ${alerta.metrica.limite} ${alerta.metrica.unidad}`}
                    </>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MetricChart serie={alerta.metrica.serie} limite={alerta.metrica.limite} direccion={alerta.metrica.direccion} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Análisis de causa raíz (8D)
                {alerta.esReal && <Badge variant="outline">Ejemplo</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EightDPanel pasos={alerta.ocho_d} progreso={alerta.ocho_d_progreso} />
            </CardContent>
          </Card>
        </div>

        <Card className="lg:w-1/2">
          <CardHeader>
            <CardTitle>Historial de la alerta</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertHistory eventos={alerta.historial} />
          </CardContent>
        </Card>
      </div>
    </OfficeShell>
  )
}

function Hecho({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      <span className="text-sm font-semibold">{valor}</span>
    </div>
  )
}

/** G7b: real data first (any known alert id, any line -- office has no
 * session/line context), then the static samples (their own fixed ids),
 * then null (the page calls notFound()). A repository failure degrades to
 * the sample fallback path rather than throwing -- the office screen must
 * not 500 just because the real lookup errored; log-and-fall-back mirrors
 * the D5/C4 pattern used elsewhere in this codebase. */
async function resolverAlerta(id: string): Promise<AlertaOficina | null> {
  try {
    const detalle = await getFloorRepository().obtenerAlerta(id)
    if (detalle) return alertaDetalleAOficina(detalle)
  } catch (err) {
    console.error("[oficina] obtenerAlerta failed:", err)
  }
  return getAlertaPorId(id) ?? null
}
