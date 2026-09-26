#!/usr/bin/env node
// J2: regenerate lib/supabase/database.types.ts without ever truncating it
// on failure. `supabase gen types typescript --local > lib/supabase/database.types.ts`
// (the previous db:types script) lets the shell truncate the committed file
// to empty the instant the CLI starts, before it has produced any output;
// if the CLI then fails (e.g. the local stack is down), the redirect still
// leaves the committed file empty/truncated. This script instead: runs the
// CLI, captures its stdout, writes it to a sibling temp file, and only
// replaces the committed file with an atomic `rename` when the CLI
// succeeded and produced non-empty output. Local stack only (`--local`);
// never touches the remote project.
import { execFileSync } from "node:child_process"
import { renameSync, unlinkSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const COMMITTED_PATH = "lib/supabase/database.types.ts"

// Pure: decides whether a completed `supabase gen types` run produced
// output safe to commit over the existing file. Exported for a cheap unit
// test; everything else in this script is a thin, hard-to-unit-test wrapper
// around a subprocess and the filesystem.
export function decideGeneration({ failed, stdout }) {
  if (failed) {
    return { ok: false, reason: "`supabase gen types typescript --local` failed" }
  }
  if (!stdout || stdout.trim().length === 0) {
    return { ok: false, reason: "the command produced empty output" }
  }
  return { ok: true }
}

function main() {
  let stdout = ""
  let failed = false
  let errorDetail = ""
  try {
    stdout = execFileSync("supabase", ["gen", "types", "typescript", "--local"], {
      encoding: "utf8",
    })
  } catch (err) {
    failed = true
    errorDetail = err?.stderr?.toString?.() ?? err?.message ?? String(err)
  }

  const decision = decideGeneration({ failed, stdout })
  if (!decision.ok) {
    console.error(
      `db:types: ${decision.reason}; ${COMMITTED_PATH} was left untouched.\n` +
        "Is the local stack running? Run `supabase start` and try again.\n" +
        errorDetail,
    )
    process.exit(1)
  }

  const tmpFile = `${COMMITTED_PATH}.tmp-${process.pid}`
  writeFileSync(tmpFile, stdout)
  try {
    renameSync(tmpFile, COMMITTED_PATH) // same directory -> atomic POSIX rename(2)
  } catch (err) {
    try {
      unlinkSync(tmpFile)
    } catch {
      // best effort cleanup
    }
    throw err
  }
  console.log(`${COMMITTED_PATH} regenerated from the local schema.`)
}

// Only run when executed directly (`node scripts/gen-db-types.mjs`), not
// when imported by the unit test below.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
