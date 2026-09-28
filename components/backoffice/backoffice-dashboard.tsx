"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ESTILOS } from "@/lib/status"
import { ejecutarAccion } from "@/lib/backoffice/acciones"
import type { EstadoDemo, LineaDemoConocida } from "@/lib/domain/floor-repository"
import { formatearHora, type Severidad } from "@/lib/mock-data"
import {
  COMUNICACIONES,
  ESCENARIOS,
  GUION_PASOS,
  PARTICIPANTE_ACTUAL,
  PLANTA_NOMBRE,
  REGISTRO_SESION,
} from "@/lib/backoffice/sample-data"

// G1: static back-office layout (odd/tasks/assets/shot-backoffice.png).
// G2: "Estado de la demo" and "Cambiar turno" now read/act on live
// FloorRepository data (see app/backoffice/page.tsx); every other action
// button stays inert ("Disponible en G3"/"Disponible en G6/G7") until its
// own task (G3 Escenarios, G6/G7 Comunicaciones, G4 Registro, G5 Guion y
// notas / Participante).

const INERT_TITLE_ESCENARIOS = "Disponible en G3"
const INERT_TITLE_COMUNICACIONES = "Disponible en G6/G7"
const INERT_TITLE_REGISTRO = "Disponible en G4"
const INERT_TITLE_NOTAS = "Disponible en G5"

export function BackofficeDashboard({ estadoDemo }: { estadoDemo: EstadoDemo }) {
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)
  const [confirmandoReinicio, setConfirmandoReinicio] = useState(false)
  const [reiniciando, setReiniciando] = useState(false)
  const [mensajeReinicio, setMensajeReinicio] = useState<string | null>(null)
  const [lineaEnCurso, setLineaEnCurso] = useState<LineaDemoConocida | null>(null)
  const [mensajeTurno, setMensajeTurno] = useState<{ linea: LineaDemoConocida; texto: string } | null>(null)

  async function onSalir() {
    if (saliendo) return
    setSaliendo(true)
    const resultado = await ejecutarAccion("/api/backoffice/sesion", { method: "DELETE" })
    if (resultado.ok) {
      router.refresh()
      return
    }
    // B1: reset the busy state and surface the error inline instead of
    // leaving "Salir" disabled forever.
    setSaliendo(false)
  }

  async function onReiniciar() {
    if (reiniciando) return
    setReiniciando(true)
    setMensajeReinicio(null)
    const resultado = await ejecutarAccion("/api/backoffice/reiniciar", { method: "POST" })
    setReiniciando(false)
    if (resultado.ok) {
      setConfirmandoReinicio(false)
      router.refresh()
      return
    }
    setMensajeReinicio(resultado.error)
  }

  async function onSimularTurno(linea: LineaDemoConocida) {
    if (lineaEnCurso) return
    setLineaEnCurso(linea)
    setMensajeTurno(null)
    const resultado = await ejecutarAccion("/api/backoffice/turno", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ linea }),
    })
    setLineaEnCurso(null)
    if (resultado.ok) {
      router.refresh()
      return
    }
    setMensajeTurno({ linea, texto: resultado.error })
  }

  return (
    <div className="mx-auto flex w-full max-w-350 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">AutoInsight · Back office</h1>
          <p className="text-sm text-neutral-500">Solo facilitador · sesión de prueba</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 border-emerald-700 text-emerald-700">
            <span className="size-2 rounded-full bg-emerald-600" aria-hidden />
            Clave verificada
          </Badge>
          <Button variant="outline" size="sm" onClick={onSalir} disabled={saliendo}>
            {saliendo ? "Saliendo…" : "Salir"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <EstadoDemoCard
          estadoDemo={estadoDemo}
          confirmando={confirmandoReinicio}
          onConfirmarChange={setConfirmandoReinicio}
          reiniciando={reiniciando}
          mensaje={mensajeReinicio}
          onReiniciar={onReiniciar}
        />
        <CambiarTurnoCard
          estadoDemo={estadoDemo}
          lineaEnCurso={lineaEnCurso}
          mensaje={mensajeTurno}
          onSimularTurno={onSimularTurno}
        />
        <EscenariosCard />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ComunicacionesCard />
        <RegistroSesionCard />
      </div>

      <GuionNotasCard />
    </div>
  )
}

function EstadoLineaChip({ estado }: { estado: Severidad }) {
  const estilo = ESTILOS[estado]
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-xs font-bold ${estilo.fondo} ${estilo.textoSobreFondo} ${estilo.borde}`}
    >
      {estilo.palabra}
    </span>
  )
}

function EstadoDemoCard({
  estadoDemo,
  confirmando,
  onConfirmarChange,
  reiniciando,
  mensaje,
  onReiniciar,
}: {
  estadoDemo: EstadoDemo
  confirmando: boolean
  onConfirmarChange: (valor: boolean) => void
  reiniciando: boolean
  mensaje: string | null
  onReiniciar: () => void
}) {
  const alertasAbiertas = estadoDemo.lineas.reduce((total, l) => total + l.alertasAbiertas, 0)
  const ultimasSimulaciones = estadoDemo.lineas
    .map((l) => l.ultimaSimulacion)
    .filter((ts): ts is number => ts !== null)
  const ultimoTurno = ultimasSimulaciones.length > 0 ? formatearHora(Math.max(...ultimasSimulaciones)) : "—"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de la demo</CardTitle>
        <CardDescription>{PLANTA_NOMBRE}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {estadoDemo.lineas.map((linea) => (
            <li key={linea.nombre} className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{linea.nombre}</span>
              <EstadoLineaChip estado={linea.estado} />
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div>
            <p className="text-xs text-neutral-500">Alertas abiertas</p>
            <p className="text-lg font-bold">{alertasAbiertas}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Último turno</p>
            <p className="text-lg font-bold">{ultimoTurno}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Button
            className="w-full bg-red-600 text-white hover:bg-red-700"
            onClick={() => onConfirmarChange(true)}
            disabled={reiniciando}
          >
            Reiniciar demo
          </Button>
          <p className="text-xs text-neutral-500">
            Vuelve al estado inicial (seed) antes de cada participante.
          </p>
        </div>

        {confirmando && (
          <div className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-800">¿Reiniciar? Se pierde el estado actual</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-red-600 text-white hover:bg-red-700"
                onClick={onReiniciar}
                disabled={reiniciando}
              >
                {reiniciando ? "Reiniciando…" : "Sí, reiniciar"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => onConfirmarChange(false)}
                disabled={reiniciando}
              >
                Cancelar
              </Button>
            </div>
            {mensaje && (
              <p role="alert" className="text-xs font-medium text-red-800">
                {mensaje}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <div>
            <p className="text-xs text-neutral-500">Participante actual</p>
            <p className="text-sm font-bold">{PARTICIPANTE_ACTUAL}</p>
          </div>
          <Button variant="secondary" size="sm" disabled title={INERT_TITLE_REGISTRO}>
            Nuevo participante
          </Button>
        </div>
        <p className="text-xs text-neutral-500">Reinicia la demo y empieza un registro nuevo.</p>
      </CardContent>
    </Card>
  )
}

function CambiarTurnoCard({
  estadoDemo,
  lineaEnCurso,
  mensaje,
  onSimularTurno,
}: {
  estadoDemo: EstadoDemo
  lineaEnCurso: LineaDemoConocida | null
  mensaje: { linea: LineaDemoConocida; texto: string } | null
  onSimularTurno: (linea: LineaDemoConocida) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambiar turno</CardTitle>
        <CardDescription>Simula el cambio de turno por línea</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {estadoDemo.lineas.map((linea) => (
          <div key={linea.nombre} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{linea.nombre}</p>
                <p className="text-xs text-neutral-500">
                  Última simulación {linea.ultimaSimulacion !== null ? formatearHora(linea.ultimaSimulacion) : "—"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => onSimularTurno(linea.nombre)}
                disabled={lineaEnCurso !== null}
              >
                {lineaEnCurso === linea.nombre ? "Simulando…" : "Simular turno"}
              </Button>
            </div>
            {mensaje?.linea === linea.nombre && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {mensaje.texto}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function EscenariosCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Escenarios</CardTitle>
        <CardDescription>Aplica un estado predefinido</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {ESCENARIOS.map((escenario) => (
          <Button
            key={escenario.id}
            variant={escenario.activo ? "outline" : "secondary"}
            className={`w-full justify-between ${escenario.activo ? "border-indigo-600 text-indigo-700" : ""}`}
            disabled
            title={INERT_TITLE_ESCENARIOS}
          >
            <span>{escenario.nombre}</span>
            {escenario.activo && (
              <Badge variant="outline" className="border-indigo-600 text-indigo-700">
                Activo
              </Badge>
            )}
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}

function ComunicacionesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comunicaciones</CardTitle>
        <CardDescription>Disponible cuando el envío esté listo</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {COMUNICACIONES.map((accion) => (
          <div key={accion.id} className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Button
                disabled
                title={INERT_TITLE_COMUNICACIONES}
                className="bg-indigo-700 text-white hover:bg-indigo-800"
              >
                {accion.etiqueta}
              </Button>
              <p className="text-xs text-neutral-500">{accion.detalle}</p>
            </div>
            <Badge variant="secondary">Próximamente</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function RegistroSesionCard() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Registro de la sesión</CardTitle>
          <CardDescription>Eventos capturados durante la prueba</CardDescription>
        </div>
        <Button variant="secondary" size="sm" disabled title={INERT_TITLE_REGISTRO}>
          Descargar CSV
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Participante</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Tiempo desde mostrada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {REGISTRO_SESION.map((evento, i) => (
              <TableRow key={i}>
                <TableCell>{evento.hora}</TableCell>
                <TableCell>{evento.participante}</TableCell>
                <TableCell>{evento.evento}</TableCell>
                <TableCell>{evento.tiempoDesdeMostrada}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function GuionNotasCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Guion y notas</CardTitle>
        <CardDescription>Lee estos pasos con el participante</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 lg:flex-row">
        <ol className="flex flex-1 list-decimal flex-col gap-1 pl-5 text-sm">
          {GUION_PASOS.map((paso, i) => (
            <li key={i}>{paso}</li>
          ))}
        </ol>
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            className="min-h-30 w-full rounded-md border border-border bg-background p-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="Notas de la sesión…"
            disabled
            title={INERT_TITLE_NOTAS}
          />
          <Button className="self-end" disabled title={INERT_TITLE_NOTAS}>
            Guardar nota
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
