import { LINEAS_DEMO_CONOCIDAS, type EstadoDemo } from "@/lib/domain/floor-repository"

/**
 * C4 (RDD review G2, 2026-09-28): `app/backoffice/page.tsx#BackofficePage`
 * used to call `getFloorRepository().estadoDemo()` directly -- a Supabase
 * outage there crashed the whole Server Component render, taking down
 * "Reiniciar demo" (the facilitator's recovery path) along with everything
 * else. This pure function isolates the decision (fetch-result -> what the
 * dashboard renders) so it is unit-testable without a server, and the page
 * component only wraps the fetch in try/catch and calls this.
 */
export type EstadoDemoFetchResult = { ok: true; data: EstadoDemo } | { ok: false; error: string }

export type EstadoDemoResuelto = { estadoDemo: EstadoDemo; error: string | null }

/**
 * On success: the real data, no error. On failure: a usable placeholder
 * (one row per known line, honestly reporting "unknown" -- 0 open alerts /
 * ok / never simulated -- rather than fabricating a larger number) so
 * "Reiniciar demo", "Cambiar turno" and "Escenarios" stay usable, plus the
 * error message for an inline banner in "Estado de la demo".
 */
export function resolverEstadoDemo(resultado: EstadoDemoFetchResult): EstadoDemoResuelto {
  if (resultado.ok) {
    return { estadoDemo: resultado.data, error: null }
  }
  return { estadoDemo: estadoDemoFallback(), error: resultado.error }
}

function estadoDemoFallback(): EstadoDemo {
  return {
    lineas: LINEAS_DEMO_CONOCIDAS.map((nombre) => ({
      nombre,
      estadoKpi: "ok" as const,
      alertasPorSeveridad: { parar: 0, atencion: 0, ok: 0 },
      alertasAbiertas: 0,
      ultimaSimulacion: null,
    })),
    escenarioActivo: null,
    // G6: the toggle itself lives in the same failed fetch -- default to ON
    // (its real default) rather than fabricating an "off" the facilitator
    // never chose; the "Comunicaciones" card stays usable regardless.
    enviarReporteTurno: true,
  }
}
