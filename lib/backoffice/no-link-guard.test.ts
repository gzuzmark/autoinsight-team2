import { describe, expect, it } from "vitest"
import { containsBackofficeLink, filesOutsideBackoffice, readFile } from "./no-link-guard"

// D28 amendment: /backoffice must never be linked from '/', '/planta' or
// '/oficina' (or anywhere else in the app) -- it is reachable only by typing
// the URL and passing the facilitator key gate. This guard scans every
// source file OUTSIDE app/backoffice/**, components/backoffice/** and
// lib/backoffice/** for anything that could link/navigate to it, so a
// future accidental link fails CI instead of only being caught by a manual
// audit.

const FILES_OUTSIDE_BACKOFFICE = filesOutsideBackoffice()

describe("D28 amendment: /backoffice is never linked from outside its own paths", () => {
  it("finds at least one file to scan (fail closed on an empty scan)", () => {
    expect(FILES_OUTSIDE_BACKOFFICE.length).toBeGreaterThan(0)
  })

  it.each(FILES_OUTSIDE_BACKOFFICE)("%s has no link/navigation to /backoffice", (file) => {
    expect(containsBackofficeLink(readFile(file))).toBe(false)
  })
})

// B2 (RDD review 2026-09-28): the original guard only matched a literal
// href="/backoffice". These unit tests pin down every pattern it now also
// catches, directly against synthetic source snippets (not real files, so
// they cannot be "fixed" by editing app/ or components/).
describe("containsBackofficeLink", () => {
  it("catches a literal href", () => {
    expect(containsBackofficeLink('<a href="/backoffice">x</a>')).toBe(true)
    expect(containsBackofficeLink("<a href='/backoffice'>x</a>")).toBe(true)
  })

  it("catches a JSX expression href with a plain string", () => {
    expect(containsBackofficeLink('<a href={"/backoffice"}>x</a>')).toBe(true)
  })

  it("catches a JSX expression href with a template literal", () => {
    expect(containsBackofficeLink("<a href={`/backoffice`}>x</a>")).toBe(true)
    expect(containsBackofficeLink("<a href={`/backoffice?tab=${tab}`}>x</a>")).toBe(true)
  })

  it("catches router.push to /backoffice", () => {
    expect(containsBackofficeLink('router.push("/backoffice")')).toBe(true)
    expect(containsBackofficeLink("router.push(`/backoffice`)")).toBe(true)
  })

  it("catches a server-side redirect to /backoffice", () => {
    expect(containsBackofficeLink('redirect("/backoffice")')).toBe(true)
  })

  it("does not flag /api/backoffice/* routes", () => {
    expect(containsBackofficeLink('fetch("/api/backoffice/sesion")')).toBe(false)
    expect(containsBackofficeLink('router.push("/api/backoffice/turno")')).toBe(false)
  })

  it("does not flag a prose/path-comparison string like 'app/backoffice'", () => {
    expect(containsBackofficeLink('normalized.startsWith("app/backoffice/")')).toBe(false)
  })

  it("does not flag unrelated content", () => {
    expect(containsBackofficeLink('<a href="/planta">Planta</a>')).toBe(false)
  })
})
