import fs from "node:fs"
import path from "node:path"

/**
 * D28 amendment: /backoffice must never be linked from '/', '/planta' or
 * '/oficina' (or anywhere else in the app) -- it is reachable only by
 * typing the URL and passing the facilitator key gate.
 *
 * B2 (RDD review 2026-09-28): the original guard only matched a literal
 * `href="/backoffice"`. It missed a JSX expression href (`href={...}`,
 * including a template literal), a client-side `router.push("/backoffice")`,
 * and a server-side `redirect("/backoffice")` -- any of those would also
 * link the route without a matching test file changing. This module is the
 * shared, directly-unit-testable detector both `no-link-guard.test.ts`'s
 * file scan (app/, components/, lib/) and its own unit tests use.
 *
 * Each pattern anchors the "/backoffice" literal right after the opening
 * quote/backtick of its call/attribute, so it never matches
 * "/api/backoffice/..." (a legitimate back-office API route) or a prose
 * mention like "app/backoffice" in a comment/string used for path
 * comparison (e.g. lib/design-rules.ts's isBackofficePath).
 */
const BACKOFFICE_LINK_PATTERNS: RegExp[] = [
  // Literal JSX attribute: href="/backoffice" / href='/backoffice'.
  /href=["']\/backoffice(?:["'/]|$)/,
  // JSX expression href with a plain/conditional string:
  // href={"/backoffice"}, href={cond ? "/backoffice" : x}.
  /href=\{[^}]*["']\/backoffice(?:["'/]|$)[^}]*\}/,
  // JSX expression href with a template literal: href={`/backoffice`},
  // href={`/backoffice?tab=${tab}`} -- matched from the opening backtick
  // alone, since a `${...}` interpolation inside the literal would close
  // the outer `[^}]*` pattern above at its own `}`.
  /href=\{\s*`\/backoffice\b/,
  // Client or server navigation: router.push("/backoffice"), redirect(`/backoffice`).
  /\b(?:router\.push|redirect)\(\s*[`'"]\/backoffice(?:["'`/]|$)/,
]

export function containsBackofficeLink(content: string): boolean {
  return BACKOFFICE_LINK_PATTERNS.some((re) => re.test(content))
}

const ROOT = path.resolve(__dirname, "..", "..")

function listSourceFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return []
  return fs
    .readdirSync(abs, { recursive: true })
    .map((f) => f.toString())
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => path.join(dir, f))
    .filter((f) => !f.includes(".test."))
}

/** Excludes the back office's own implementation, which legitimately
 * defines its own route. */
export function isBackofficeOwnPath(file: string): boolean {
  const normalized = file.split(path.sep).join("/")
  return (
    normalized.startsWith("app/backoffice/") ||
    normalized.startsWith("components/backoffice/") ||
    normalized.startsWith("lib/backoffice/")
  )
}

/** B2: now scans lib/ too (the original guard only scanned app/ and
 * components/), since a navigation helper living in lib/ (e.g. a shared
 * redirect() call) is just as capable of linking the route. */
export function filesOutsideBackoffice(): string[] {
  return [...listSourceFiles("app"), ...listSourceFiles("components"), ...listSourceFiles("lib")].filter(
    (f) => !isBackofficeOwnPath(f),
  )
}

export function readFile(file: string): string {
  return fs.readFileSync(path.join(ROOT, file), "utf-8")
}
