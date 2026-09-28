"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

// G1: facilitator key form (D28 amendment). Posts to /api/backoffice/sesion,
// which does the real verification server-side (constant-time compare,
// fails closed when BACKOFFICE_KEY is unset); this component only relays
// the server's response and re-renders the page on success so the server
// component re-reads the fresh cookie.
export function KeyGateForm({ configured }: { configured: boolean }) {
  const router = useRouter()
  const [clave, setClave] = useState("")
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!configured || enviando) return
    setEnviando(true)
    setMensaje(null)
    try {
      const res = await fetch("/api/backoffice/sesion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clave }),
      })
      if (res.status === 204) {
        router.refresh()
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setMensaje(body?.error ?? "No se pudo verificar la clave.")
    } catch {
      setMensaje("No se pudo verificar la clave.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>AutoInsight · Back office</CardTitle>
          <CardDescription>Solo facilitador · sesión de prueba</CardDescription>
        </CardHeader>
        <CardContent>
          {!configured ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              Back office deshabilitado: falta BACKOFFICE_KEY
            </p>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={onSubmit}>
              <label htmlFor="backoffice-clave" className="text-sm font-medium">
                Clave de facilitador
              </label>
              <Input
                id="backoffice-clave"
                name="clave"
                type="password"
                autoComplete="off"
                value={clave}
                onChange={(event) => setClave(event.target.value)}
                disabled={enviando}
              />
              {mensaje && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {mensaje}
                </p>
              )}
              <Button type="submit" disabled={enviando || clave.length === 0}>
                {enviando ? "Verificando…" : "Entrar"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
