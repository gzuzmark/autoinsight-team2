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
})

if (!canRun) {
  // eslint-disable-next-line no-console
  console.log(
    "SupabaseFloorRepository integration test SKIPPED: set SUPABASE_URL and SUPABASE_SECRET_KEY " +
      "(e.g. `supabase status -o env` against a running local stack) to run it.",
  )
}
