"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ESTILOS } from "@/lib/status"
import { ejecutarAccion } from "@/lib/backoffice/acciones"
import { formatearResumenAlertas } from "@/lib/backoffice/resumen-alertas"
import type { EscenarioId, EstadoDemo, LineaDemoConocida } from "@/lib/domain/floor-repository"
import { ESCENARIOS } from "@/lib/domain/floor-repository"
import { formatearHora, type Severidad } from "@/lib/mock-data"
import { COMUNICACIONES, GUION_PASOS, PARTICIPANTE_ACTUAL, PLANTA_NOMBRE, REGISTRO_SESION } from "@/lib/backoffice/sample-data"

// G1: static back-office layout (odd/tasks/assets/shot-backoffice.png).
// G2: "Estado de la demo" and "Cambiar turno" read/act on live
// FloorRepository data (see app/backoffice/page.tsx).
// G3: "Escenarios" does too.
// Every other action button stays inert ("Disponible en G6/G7"/"Disponible
// en G4"/"Disponible en G5") until its own task.

const INERT_TITLE_COMUNICACIONES = "Disponible en G7 (Disparar push)"
const INERT_TITLE_REGISTRO = "Disponible en G4"
const INERT_TITLE_NOTAS = "Disponible en G5"

export function BackofficeDashboard({
  estadoDemo,
  error,
}: {
  estadoDemo: EstadoDemo
  /** C4 (RDD review G2): non-null when estadoDemo() failed server-side --
   * `estadoDemo` is then a usable placeholder, not real data (see
   * lib/backoffice/estado-demo-fallback.ts). Shown as an inline banner;
   * every action button below stays usable regardless. */
  error?: string | null
}) {
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)
  const [confirmandoReinicio, setConfirmandoReinicio] = useState(false)
  const [reiniciando, setReiniciando] = useState(false)
  const [mensajeReinicio, setMensajeReinicio] = useState<string | null>(null)
  const [lineaEnCurso, setLineaEnCurso] = useState<LineaDemoConocida | null>(null)
  const [mensajeTurno, setMensajeTurno] = useState<
    { linea: LineaDemoConocida; texto: string; esError: boolean } | null
  >(null)
  const [escenarioEnCurso, setEscenarioEnCurso] = useState<EscenarioId | null>(null)
  const [mensajeEscenario, setMensajeEscenario] = useState<{ id: EscenarioId; texto: string } | null>(null)
  const [cambiandoToggleCorreo, setCambiandoToggleCorreo] = useState(false)
  const [enviandoCorreo, setEnviandoCorreo] = useState(false)
  const [mensajeCorreo, setMensajeCorreo] = useState<{ texto: string; esError: boolean } | null>(null)

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
      // G6: the route reports whether it also sent a shift-report email
      // (correo: "enviado" | "omitido" | "error") -- shown inline here
      // regardless, since the shift itself already succeeded either way.
      const correo = (resultado.data as { correo?: string } | undefined)?.correo
      if (correo === "enviado") {
        setMensajeTurno({ linea, texto: "Turno simulado · reporte enviado", esError: false })
      } else if (correo === "error") {
        setMensajeTurno({ linea, texto: "Turno simulado · no se pudo enviar el reporte", esError: true })
      }
      router.refresh()
      return
    }
    setMensajeTurno({ linea, texto: resultado.error, esError: true })
  }

  async function onCambiarToggleCorreo(valor: boolean) {
    if (cambiandoToggleCorreo) return
    setCambiandoToggleCorreo(true)
    const resultado = await ejecutarAccion("/api/backoffice/configuracion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enviarReporteTurno: valor }),
    })
    setCambiandoToggleCorreo(false)
    if (resultado.ok) {
      router.refresh()
      return
    }
    setMensajeCorreo({ texto: resultado.error, esError: true })
  }

  async function onEnviarCorreoAhora() {
    if (enviandoCorreo) return
    setEnviandoCorreo(true)
    setMensajeCorreo(null)
    const resultado = await ejecutarAccion("/api/backoffice/correo", { method: "POST" })
    setEnviandoCorreo(false)
    setMensajeCorreo(
      resultado.ok ? { texto: "Correo enviado", esError: false } : { texto: resultado.error, esError: true },
    )
  }

  async function onAplicarEscenario(id: EscenarioId) {
    if (escenarioEnCurso) return
    setEscenarioEnCurso(id)
    setMensajeEscenario(null)
    const resultado = await ejecutarAccion("/api/backoffice/escenario", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ escenario: id }),
    })
    setEscenarioEnCurso(null)
    if (resultado.ok) {
      router.refresh()
      return
    }
    setMensajeEscenario({ id, texto: resultado.error })
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
          error={error ?? null}
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
        <EscenariosCard
          escenarioActivo={estadoDemo.escenarioActivo}
          escenarioEnCurso={escenarioEnCurso}
          mensaje={mensajeEscenario}
          onAplicarEscenario={onAplicarEscenario}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ComunicacionesCard
          enviarReporteTurno={estadoDemo.enviarReporteTurno}
          cambiandoToggle={cambiandoToggleCorreo}
          onCambiarToggle={onCambiarToggleCorreo}
          enviandoCorreo={enviandoCorreo}
          mensajeCorreo={mensajeCorreo}
          onEnviarCorreoAhora={onEnviarCorreoAhora}
        />
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
  error,
  confirmando,
  onConfirmarChange,
  reiniciando,
  mensaje,
  onReiniciar,
}: {
  estadoDemo: EstadoDemo
  error: string | null
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
        {/* C4 (RDD review G2): estadoDemo() failed server-side -- estadoDemo
            above is a placeholder, not real state. Reiniciar demo/Cambiar
            turno/Escenarios stay usable regardless (see the prop doc). */}
        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-xs font-medium text-red-800">
            {error}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {estadoDemo.lineas.map((linea) => (
            <li key={linea.nombre} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{linea.nombre}</span>
                <EstadoLineaChip estado={linea.estadoKpi} />
              </div>
              <p className="text-xs text-neutral-500">{formatearResumenAlertas(linea.alertasPorSeveridad)}</p>
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
  mensaje: { linea: LineaDemoConocida; texto: string; esError: boolean } | null
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
          // C1 (RDD review G2): data-linea disambiguates each line's
          // "Simular turno" button for scripts/ui-check.mjs -- every line's
          // button shares the same accessible name ("Simular turno"), so a
          // name-only locator can match ANY of the 3 (including one that
          // was never clicked and is already idle) instead of the specific
          // one the test clicked.
          <div key={linea.nombre} data-linea={linea.nombre} className="flex flex-col gap-1">
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
              <p
                role={mensaje.esError ? "alert" : "status"}
                className={`text-xs font-medium ${mensaje.esError ? "text-destructive" : "text-emerald-700"}`}
              >
                {mensaje.texto}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function EscenariosCard({
  escenarioActivo,
  escenarioEnCurso,
  mensaje,
  onAplicarEscenario,
}: {
  escenarioActivo: EscenarioId | null
  escenarioEnCurso: EscenarioId | null
  mensaje: { id: EscenarioId; texto: string } | null
  onAplicarEscenario: (id: EscenarioId) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Escenarios</CardTitle>
        <CardDescription>Aplica un estado predefinido</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {ESCENARIOS.map((escenario) => {
          const activo = escenarioActivo === escenario.id
          return (
            // C1: data-escenario disambiguates each scenario's button for
            // scripts/ui-check.mjs, same rationale as CambiarTurnoCard's
            // data-linea above.
            <div key={escenario.id} data-escenario={escenario.id} className="flex flex-col gap-1">
              <Button
                variant={activo ? "outline" : "secondary"}
                className={`w-full justify-between ${activo ? "border-indigo-600 text-indigo-700" : ""}`}
                onClick={() => onAplicarEscenario(escenario.id)}
                disabled={escenarioEnCurso !== null}
              >
                <span>{escenarioEnCurso === escenario.id ? "Aplicando…" : escenario.nombre}</span>
                {activo && (
                  <Badge variant="outline" className="border-indigo-600 text-indigo-700">
                    Activo
                  </Badge>
                )}
              </Button>
              {mensaje?.id === escenario.id && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {mensaje.texto}
                </p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ComunicacionesCard({
  enviarReporteTurno,
  cambiandoToggle,
  onCambiarToggle,
  enviandoCorreo,
  mensajeCorreo,
  onEnviarCorreoAhora,
}: {
  enviarReporteTurno: boolean
  cambiandoToggle: boolean
  onCambiarToggle: (valor: boolean) => void
  enviandoCorreo: boolean
  mensajeCorreo: { texto: string; esError: boolean } | null
  onEnviarCorreoAhora: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comunicaciones</CardTitle>
        <CardDescription>Reporte de turno por correo</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Enviar reporte al simular turno</p>
            <p className="text-xs text-neutral-500">Se envía tras cada "Simular turno" en la tarjeta de arriba.</p>
          </div>
          <Button
            role="switch"
            aria-checked={enviarReporteTurno}
            variant={enviarReporteTurno ? "default" : "secondary"}
            size="sm"
            onClick={() => onCambiarToggle(!enviarReporteTurno)}
            disabled={cambiandoToggle}
          >
            {enviarReporteTurno ? "Activado" : "Desactivado"}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex flex-col gap-1">
            <Button onClick={onEnviarCorreoAhora} disabled={enviandoCorreo}>
              {enviandoCorreo ? "Enviando…" : "Enviar correo ahora"}
            </Button>
            <p className="text-xs text-neutral-500">Reporte de estado actual de las 3 líneas.</p>
          </div>
        </div>
        {mensajeCorreo && (
          <p
            role={mensajeCorreo.esError ? "alert" : "status"}
            className={`text-xs font-medium ${mensajeCorreo.esError ? "text-destructive" : "text-emerald-700"}`}
          >
            {mensajeCorreo.texto}
          </p>
        )}

        {COMUNICACIONES.map((accion) => (
          <div key={accion.id} className="flex items-center justify-between gap-3 border-t border-border pt-3">
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
