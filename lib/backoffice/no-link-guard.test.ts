import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// D28 amendment: /backoffice must never be linked from '/', '/planta' or
// '/oficina' (or anywhere else in the app) -- it is reachable only by typing
// the URL and passing the facilitator key gate. This guard scans every
// source file OUTSIDE app/backoffice/** and components/backoffice/** for a
// literal href to it, so a future accidental link fails CI instead of only
// being caught by a manual audit.

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

function isBackofficeOwnPath(file: string): boolean {
  const normalized = file.split(path.sep).join("/")
  return normalized.startsWith("app/backoffice/") || normalized.startsWith("components/backoffice/")
}

const FILES_OUTSIDE_BACKOFFICE = [...listSourceFiles("app"), ...listSourceFiles("components")].filter(
  (f) => !isBackofficeOwnPath(f),
)

describe("D28 amendment: /backoffice is never linked from outside its own paths", () => {
  it("finds at least one file to scan (fail closed on an empty scan)", () => {
    expect(FILES_OUTSIDE_BACKOFFICE.length).toBeGreaterThan(0)
  })

  it.each(FILES_OUTSIDE_BACKOFFICE)('%s has no href="/backoffice"', (file) => {
    const content = fs.readFileSync(path.join(ROOT, file), "utf-8")
    expect(content).not.toMatch(/href=["']\/backoffice(?:["'/]|$)/)
  })
})
