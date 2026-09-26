#!/usr/bin/env node
// H7: fails (non-zero exit) if lib/supabase/database.types.ts is stale
// relative to the local Supabase schema. Regenerates the types to a temp
// file with `supabase gen types typescript --local` (local stack only) and
// diffs it against the committed file; never touches the remote project.
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const COMMITTED_PATH = "lib/supabase/database.types.ts"

function generateTypes() {
  return execFileSync("supabase", ["gen", "types", "typescript", "--local"], {
    encoding: "utf8",
  })
}

const generated = generateTypes()
const committed = readFileSync(COMMITTED_PATH, "utf8")

if (generated === committed) {
  console.log(`${COMMITTED_PATH} is up to date with the local schema.`)
  process.exit(0)
}

const dir = mkdtempSync(join(tmpdir(), "db-types-check-"))
const tmpFile = join(dir, "database.types.ts")
writeFileSync(tmpFile, generated)

console.error(
  `${COMMITTED_PATH} is out of date with the local schema.\n` +
    `Freshly generated types written to: ${tmpFile}\n` +
    `Run: supabase gen types typescript --local > ${COMMITTED_PATH}`,
)
process.exit(1)
