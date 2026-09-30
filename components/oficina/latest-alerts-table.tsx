import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { VARIANTE_POR_GRAVEDAD, type EstadoAlerta } from "@/lib/oficina/mock-data"
import type { FilaTablaAlertas } from "@/lib/oficina/resumen-vista"

const COLOR_ESTADO: Record<EstadoAlerta, string> = {
  Nueva: "text-indigo-700",
  Atendida: "text-emerald-700",
  "No aplica": "text-neutral-500",
}

// G10: takes the narrower FilaTablaAlertas shape (id/gravedad/titulo/
// lineaEstacion/estado/hace) instead of the full sample AlertaOficina --
// a real resumenOficina() row has no chart/8D/history backing data, so it
// is never fabricated just to satisfy this table's prop type.
export function LatestAlertsTable({ alertas }: { alertas: FilaTablaAlertas[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Gravedad</TableHead>
          <TableHead>Alerta</TableHead>
          <TableHead>Línea / estación</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Hace</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {alertas.map((a) => (
          <TableRow key={a.id}>
            <TableCell>
              <Badge variant={VARIANTE_POR_GRAVEDAD[a.gravedad]}>{a.gravedad}</Badge>
            </TableCell>
            <TableCell>
              <Link href={`/oficina/alertas/${a.id}`} className="font-medium text-indigo-700 hover:underline">
                {a.titulo}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{a.lineaEstacion}</TableCell>
            <TableCell className={`font-medium ${COLOR_ESTADO[a.estado]}`}>{a.estado}</TableCell>
            <TableCell className="text-muted-foreground">{a.hace}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
