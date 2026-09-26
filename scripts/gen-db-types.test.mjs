// J2: unit tests for the pure part of gen-db-types.mjs -- the decision of
// whether a completed `supabase gen types` run is safe to write over the
// committed file. Everything else in that script (subprocess execution,
// filesystem rename) is a thin wrapper not worth mocking here; it is
// verified manually (see the ODD task doc) by running db:types with the
// local stack stopped and confirming the committed file is unchanged.
import { describe, expect, it } from "vitest"
import { decideGeneration } from "./gen-db-types.mjs"

describe("decideGeneration", () => {
  it("rejects a failed CLI run", () => {
    expect(decideGeneration({ failed: true, stdout: "" })).toEqual({
      ok: false,
      reason: "`supabase gen types typescript --local` failed",
    })
  })

  it("rejects empty output even when the CLI reported success", () => {
    expect(decideGeneration({ failed: false, stdout: "" })).toEqual({
      ok: false,
      reason: "the command produced empty output",
    })
  })

  it("rejects whitespace-only output", () => {
    expect(decideGeneration({ failed: false, stdout: "   \n  " })).toEqual({
      ok: false,
      reason: "the command produced empty output",
    })
  })

  it("accepts non-empty output from a successful run", () => {
    expect(decideGeneration({ failed: false, stdout: "export type Database = {}" })).toEqual({
      ok: true,
    })
  })
})
