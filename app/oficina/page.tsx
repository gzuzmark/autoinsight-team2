import { OfficeShell } from "@/components/oficina/office-shell"
import { FilterBar } from "@/components/oficina/filter-bar"
import { FpyTrendChart } from "@/components/oficina/fpy-trend-chart"
import { ParetoDefectos } from "@/components/oficina/pareto-defectos"
import { AlertHeatmap } from "@/components/oficina/alert-heatmap"
import { ResumenKpis, ResumenAlertasTable } from "@/components/oficina/resumen-contenido"
import { ResumenOficinaProvider } from "@/components/oficina/resumen-provider"
import { ResumenSubtitle } from "@/components/oficina/resumen-subtitle"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FPY_TENDENCIA, PARETO_DEFECTOS, TOTAL_DEFECTOS_PARETO, HEATMAP_ALERTAS } from "@/lib/oficina/mock-data"
import { getFloorRepository } from "@/lib/floor-repository"
import type { ResumenOficina } from "@/lib/domain/floor-repository"

// G10: this page's initial render reads live repository data with no
// cookies/headers/searchParams dependency, so Next would otherwise treat it
// as fully static and bake the build-time resumen into every request
// (Cache Components is not enabled in next.config.mjs, so the classic
// `dynamic` route segment config still applies here -- see
// node_modules/next/dist/docs/.../route-segment-config/index.md's version
// history). Forcing dynamic rendering keeps the initial KPI values as fresh
// as the request, same as /backoffice (which gets this for free via its own
// cookies() read).
export const dynamic = "force-dynamic"

// Screen 01 (Resumen de planta, O2). G10: the KPI cards and "Últimas
// alertas" table are wired to the real floor repository (Supabase in prod,
// InMemory in mock mode) -- initial data fetched server-side here, then
// ResumenOficinaProvider polls GET /api/oficina/resumen every 15s (D29-style)
// to keep them live. FPY trend, Pareto and the alert heatmap have no real
// backing data yet and stay labeled "Ejemplo" (same convention as the alert
// investigation screen, G7b); the filter bar is non-functional (O-D4).
export default async function ResumenPage() {
  const resumenInicial = await resolverResumenInicial()

  return (
    <ResumenOficinaProvider inicial={resumenInicial}>
      <OfficeShell pathname="/oficina" title="Resumen de planta" subtitle={<ResumenSubtitle />}>
        <div className="flex flex-col gap-4">
          <FilterBar />

          <ResumenKpis />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Tendencia de FPY · Línea 3
                  <Badge variant="outline">Ejemplo</Badge>
                </CardTitle>
                <CardDescription>FPY diario de los últimos 30 días, coloreado por umbral</CardDescription>
              </CardHeader>
              <CardContent>
                <FpyTrendChart puntos={FPY_TENDENCIA} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Pareto de defectos
                  <Badge variant="outline">Ejemplo</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ParetoDefectos causas={PARETO_DEFECTOS} total={TOTAL_DEFECTOS_PARETO} />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Alertas por línea y estación
                  <Badge variant="outline">Ejemplo</Badge>
                </CardTitle>
                <CardDescription>Últimos 7 días</CardDescription>
              </CardHeader>
              <CardContent>
                <AlertHeatmap filas={HEATMAP_ALERTAS} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Últimas alertas</CardTitle>
                <CardDescription>Todas las líneas</CardDescription>
              </CardHeader>
              <CardContent>
                <ResumenAlertasTable />
              </CardContent>
            </Card>
          </div>
        </div>
      </OfficeShell>
    </ResumenOficinaProvider>
  )
}

/** G10: same log-and-degrade pattern as the alert investigation page's
 * `resolverAlerta` (G7b) -- a repository failure at first render must not
 * 500 the whole Resumen screen; ResumenOficinaProvider/ResumenKpis already
 * know how to render a null resumen honestly, and the client poll gets
 * another chance 15s later. */
async function resolverResumenInicial(): Promise<ResumenOficina | null> {
  try {
    return await getFloorRepository().resumenOficina()
  } catch (err) {
    console.error("[oficina] resumenOficina failed:", err)
    return null
  }
}
