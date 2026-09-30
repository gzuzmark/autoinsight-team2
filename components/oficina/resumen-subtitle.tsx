"use client"

import { useEffect, useState } from "react"
import { useResumenOficina } from "@/components/oficina/resumen-provider"
import { haceCuanto } from "@/lib/mock-data"

/**
 * G10: office Resumen header subtitle -- "Planta Norte · actualizado hace X"
 * from the last successful GET /api/oficina/resumen fetch (ResumenOficinaProvider),
 * "Planta Norte · sin datos todavía" before the first one lands. A local
 * 30s re-render tick keeps "hace X min" advancing between polls, same as
 * the floor header's own "Última actualización" text needing no network
 * activity to stay current.
 */
export function ResumenSubtitle() {
  const { ultimoFetchOk } = useResumenOficina()
  const [, forzarRenderizado] = useState(0)

  useEffect(() => {
    const id = setInterval(() => forzarRenderizado((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  if (ultimoFetchOk === null) return <>Planta Norte · sin datos todavía</>
  return <>Planta Norte · actualizado {haceCuanto(ultimoFetchOk)}</>
}
