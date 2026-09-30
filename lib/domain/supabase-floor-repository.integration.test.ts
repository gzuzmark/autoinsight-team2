import { createClient } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { SessionInvalidError } from "@/lib/domain/floor-repository"
import { SupabaseFloorRepository } from "@/lib/domain/supabase-floor-repository"

/**
 * Integration test against a REAL Supabase stack. Runs only when
 * `SUPABASE_URL`/`SUPABASE_SECRET_KEY` are set and point at a reachable
 * instance -- normally the LOCAL stack (`supabase start`); skips (clearly,
 * via `describe.skipIf`'s reported "skipped" status) otherwise, so
 * `corepack pnpm test:run` never depends on Docker/network being available.
 *
 * Never point this at a remote project when running it by hand -- see the
 * README "Supabase (local)" section and the hard boundary against touching
 * anything but the local stack.
 */
const url = process.env.SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const canRun = Boolean(url && secretKey)

// Ana Ríos, seeded in supabase/seed.sql with PIN 1234 on Línea 3 · Motores.
const ANA_ID = "00000000-0000-0000-0000-000000000101"
const ANA_PIN = "1234"

describe.skipIf(!canRun)("SupabaseFloorRepository (integration, local stack)", () => {
  // `describe`'s own body always runs, even when every `it` inside is
  // skipped by `skipIf` -- so the repository is only constructed when
  // `canRun` is true (a real url/secretKey are guaranteed by the guard
  // above), never eagerly with the possibly-undefined env vars.
  const repo = canRun ? new SupabaseFloorRepository(url!, secretKey!) : (null as never)

  it("usuariosLogin returns the seeded active users without PIN data", async () => {
    const usuarios = await repo.usuariosLogin()
    expect(usuarios.length).toBeGreaterThan(0)
    const ana = usuarios.find((u) => u.id === ANA_ID)
    expect(ana?.nombre).toBe("Ana Ríos")
    expect(ana).not.toHaveProperty("pin")
  })

  it("iniciarSesion returns null on a wrong PIN", async () => {
    const sessionId = await repo.iniciarSesion(ANA_ID, "0000")
    expect(sessionId).toBeNull()
  })

  it("logs in, reads the tablero, resolves an alert, and logs out", async () => {
    const sessionId = await repo.iniciarSesion(ANA_ID, ANA_PIN)
    expect(sessionId).toEqual(expect.any(String))

    const tablero = await repo.tablero(sessionId!)
    expect(tablero.planta.nombre).toBe("Planta Norte")
    expect(tablero.linea.nombre).toBe("Línea 3 · Motores")
    expect(tablero.usuario.id).toBe(ANA_ID)
    expect(tablero.alertas.length).toBeGreaterThan(0)

    const targetId = tablero.alertas[0].id
    await repo.resolverAlerta(sessionId!, targetId, "atendida")
    const after = await repo.tablero(sessionId!)
    expect(after.alertas.find((a) => a.id === targetId)).toBeUndefined()

    await repo.cerrarSesion(sessionId!)
    await expect(repo.tablero(sessionId!)).rejects.toBeInstanceOf(SessionInvalidError)
  })

  it("resolverAlerta throws for an unknown alert id", async () => {
    const sessionId = await repo.iniciarSesion(ANA_ID, ANA_PIN)
    await expect(
      repo.resolverAlerta(sessionId!, "00000000-0000-0000-0000-000000000000", "atendida"),
    ).rejects.toThrow()
  })

  it("tablero throws SessionInvalidError for an unknown session", async () => {
    await expect(repo.tablero("00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(
      SessionInvalidError,
    )
  })

  // G7b: office investigation screen real-data lookup.
  it("obtenerAlerta returns null for a non-uuid id (office sample-alert id shape) and for an unknown uuid", async () => {
    expect(await repo.obtenerAlerta("torque-fuera-de-rango-l3-e7")).toBeNull()
    expect(await repo.obtenerAlerta("00000000-0000-0000-0000-000000000000")).toBeNull()
  })

  it("obtenerAlerta finds a real seeded alert with linea/estacion/valor/limite from the alertas row", async () => {
    const sessionId = await repo.iniciarSesion(ANA_ID, ANA_PIN)
    const tablero = await repo.tablero(sessionId!)
    const alertaId = tablero.alertas[0].id

    const detalle = await repo.obtenerAlerta(alertaId)
    expect(detalle).not.toBeNull()
    expect(detalle!.id).toBe(alertaId)
    expect(detalle!.linea).toBe("Línea 3 · Motores")
    expect(detalle!.estado).toBe("nueva")
    expect(detalle!.resueltaEn).toBeNull()

    await repo.cerrarSesion(sessionId!)
  })

  // Regression for the safeupdate hotfix: `authenticator` (the role
  // PostgREST always connects as) preloads pg-safeupdate, which rejects any
  // UPDATE/DELETE without a WHERE clause -- including inside a SECURITY
  // DEFINER function called through the API. pgTAP (supabase/tests) runs as
  // plain postgres, which never preloads safeupdate, so it never caught
  // this; only a real PostgREST round-trip like this one does. Every RPC
  // below returned a PostgREST 500 ("UPDATE/DELETE requires a WHERE
  // clause") before the fix.
  it("back-office demo RPCs run over PostgREST without a safeupdate error", async () => {
    await expect(repo.reiniciarDemo()).resolves.toBeUndefined()

    for (const linea of ["Línea 1 · Chasis", "Línea 2 · Pintura", "Línea 3 · Motores"] as const) {
      // G6: simularTurno now resolves to the shift-report data, not void --
      // exercised over a real PostgREST round-trip (the RPC's own returned
      // alerts, plus the two direct public.indicadores/alertas reads).
      await expect(repo.simularTurno(linea)).resolves.toEqual(
        expect.objectContaining({
          linea,
          nuevasAlertas: expect.any(Array),
          indicadores: expect.any(Array),
          alertasAbiertas: expect.any(Number),
        }),
      )
    }

    for (const escenario of ["todo-ok", "linea3-parar-alta", "muchas-media", "recuperacion"] as const) {
      await expect(repo.aplicarEscenario(escenario)).resolves.toBeUndefined()
    }

    await expect(repo.estadoDemo()).resolves.toEqual(
      expect.objectContaining({
        lineas: expect.any(Array),
        enviarReporteTurno: expect.any(Boolean),
        // Batch I: real fetch, never the D3 fallback's false.
        datosDisponibles: true,
      }),
    )

    // Batch I: demo_estado_lineas()'s new `indicadores` field, over a real
    // PostgREST round-trip -- fpy/dph/scrap in that stable order.
    const estado = await repo.estadoDemo()
    const linea3 = estado.lineas.find((l) => l.nombre === "Línea 3 · Motores")!
    expect(linea3.indicadores.map((i) => i.clave)).toEqual(["fpy", "dph", "scrap"])
    for (const i of linea3.indicadores) expect(["ok", "atencion", "parar"]).toContain(i.estado)

    // G6: the toggle RPCs run over PostgREST too (same safeupdate concern:
    // the setter is an UPDATE on the demo_configuracion singleton).
    await expect(repo.setEnviarReporteTurno(false)).resolves.toBeUndefined()
    await expect(repo.estadoDemo()).resolves.toEqual(
      expect.objectContaining({ enviarReporteTurno: false }),
    )
    await repo.setEnviarReporteTurno(true)

    // Leave the demo state clean for anything that runs after this file.
    await repo.reiniciarDemo()
  })

  it("alertaAltaMasReciente finds a real open ALTA alert after the linea3-parar-alta scenario", async () => {
    await repo.aplicarEscenario("linea3-parar-alta")
    const resultado = await repo.alertaAltaMasReciente()
    expect(resultado).not.toBeNull()
    expect(resultado!.linea).toBe("Línea 3 · Motores")
    expect(resultado!.alerta.severidad).toBe("parar")
    await repo.reiniciarDemo()
  })

  it("G9: alertasAltaRecientes finds a real open ALTA alert, newest first, and keeps it after it is resolved", async () => {
    await repo.aplicarEscenario("linea3-parar-alta")
    const abiertas = await repo.alertasAltaRecientes()
    expect(abiertas.length).toBeGreaterThan(0)
    expect(abiertas[0].severidad).toBe("parar")
    expect(abiertas[0].linea).toBe("Línea 3 · Motores")

    const sessionId = await repo.iniciarSesion(ANA_ID, ANA_PIN)
    await repo.resolverAlerta(sessionId!, abiertas[0].id, "atendida")
    await repo.cerrarSesion(sessionId!)

    const tras = await repo.alertasAltaRecientes()
    expect(tras.some((a) => a.id === abiertas[0].id)).toBe(true)
    await repo.reiniciarDemo()
  })

  it("G8: nuevoParticipante advances the counter over a real PostgREST round-trip, reflected in estadoDemo/tablero", async () => {
    const antes = (await repo.estadoDemo()).participanteActual!
    try {
      const nuevo = await repo.nuevoParticipante()
      expect(nuevo).toBe(antes + 1)

      const estado = await repo.estadoDemo()
      expect(estado.participanteActual).toBe(nuevo)

      const sessionId = await repo.iniciarSesion(ANA_ID, ANA_PIN)
      const tablero = await repo.tablero(sessionId!)
      expect(tablero.participante).toBe(nuevo)
      await repo.cerrarSesion(sessionId!)
    } finally {
      // K-2: this test's own nuevoParticipante() call permanently advances
      // private.demo_configuracion.participante_actual on the shared local
      // stack -- neither reiniciarDemo() nor aplicarEscenario() touch that
      // column by design (see migration 20260929000029's comment), so
      // nothing else in this suite resets it back down. Left unrestored,
      // supabase/tests/21_demo_participante.test.sql's "defaults to 1"
      // assertion fails the next time `supabase test db` runs WITHOUT a
      // `supabase db reset --local` in between (pgTAP's own
      // `begin; ... rollback;` wrapper only protects state pgTAP itself
      // changes, not state this already-committed JS process changed).
      // Restore it here, via the test/ops-only RPC added for exactly this
      // (migration 20260929000030), using a fresh admin client rather than
      // the repository under test -- this call is not part of
      // SupabaseFloorRepository's production surface.
      const admin = createClient(url!, secretKey!)
      const { error } = await admin.rpc("demo_restaurar_participante_actual", { p_valor: antes })
      if (error) throw error
    }
  })

  it("G10: resumenOficina returns real fpy/dph/scrap averages, open-alert counts and latest alerts", async () => {
    await repo.aplicarEscenario("linea3-parar-alta")
    try {
      const resumen = await repo.resumenOficina()

      expect(resumen.indicadores.map((i) => i.clave)).toEqual(["fpy", "dph", "scrap"])
      for (const indicador of resumen.indicadores) {
        expect(indicador.porLinea.length).toBeGreaterThan(0)
      }

      expect(resumen.alertasAbiertas).toBeGreaterThan(0)
      expect(resumen.alertasAbiertasAlta).toBeGreaterThan(0)

      expect(resumen.ultimasAlertas.length).toBeGreaterThan(0)
      expect(resumen.ultimasAlertas.some((a) => a.linea === "Línea 3 · Motores")).toBe(true)
      for (let i = 1; i < resumen.ultimasAlertas.length; i++) {
        expect(resumen.ultimasAlertas[i - 1].creadaEn).toBeGreaterThanOrEqual(resumen.ultimasAlertas[i].creadaEn)
      }
    } finally {
      await repo.reiniciarDemo()
    }
  })

  it("G10: resumenOficina reports a real mean attention time once an alert is resolved", async () => {
    await repo.aplicarEscenario("linea3-parar-alta")
    try {
      const sessionId = await repo.iniciarSesion(ANA_ID, ANA_PIN)
      const abierta = await repo.alertaAltaMasReciente()
      expect(abierta).not.toBeNull()
      await repo.resolverAlerta(sessionId!, abierta!.alerta.id, "atendida")
      await repo.cerrarSesion(sessionId!)

      const resumen = await repo.resumenOficina()
      expect(resumen.tiempoMedioAtencionMin).not.toBeNull()
      expect(resumen.tiempoMedioAtencionMin!).toBeGreaterThanOrEqual(0)
    } finally {
      await repo.reiniciarDemo()
    }
  })
})

if (!canRun) {
  // eslint-disable-next-line no-console
  console.log(
    "SupabaseFloorRepository integration test SKIPPED: set SUPABASE_URL and SUPABASE_SECRET_KEY " +
      "(e.g. `supabase status -o env` against a running local stack) to run it.",
  )
}
