import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { ESTILOS, NOTIFICACION } from "./status"
import { isBackofficePath, isOfficePath, scanForViolations } from "./design-rules"

// Guards D4-D13 (see odd/tasks/autoinsight-port.md) so a future change that
// violates a floor design rule fails fast in CI, instead of only being
// caught by a manual browser check.

const ROOT = path.resolve(__dirname, "..")

/**
 * Normalizes a hex color to 6-digit lowercase form, expanding the 3-digit
 * shorthand (#rgb -> #rrggbb). Throws a clear error for anything else (wrong
 * length, non-hex characters, missing "#") instead of letting the luminance
 * computation below silently misread a malformed palette entry (F6).
 */
function normalizeHex(hex: string): string {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex)
  if (!m) {
    throw new Error(`Invalid hex color "${hex}": expected #rgb or #rrggbb.`)
  }
  const digits = m[1]
  const expanded =
    digits.length === 3
      ? digits
          .split("")
          .map((d) => d + d)
          .join("")
      : digits
  return `#${expanded.toLowerCase()}`
}

function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex)
  const c = normalized.replace("#", "").match(/\w\w/g)!.map((x) => parseInt(x, 16) / 255)
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA)
  const lb = relativeLuminance(hexB)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

function hexFromTailwindArbitrary(cls: string): string {
  const m = cls.match(/\[(#[0-9a-fA-F]{3,8})\]/)
  if (!m) throw new Error(`Could not extract a hex color from "${cls}"`)
  return m[1]
}

describe("D10: status palette", () => {
  const bgHex = {
    ok: hexFromTailwindArbitrary(ESTILOS.ok.fondo),
    atencion: hexFromTailwindArbitrary(ESTILOS.atencion.fondo),
    parar: hexFromTailwindArbitrary(ESTILOS.parar.fondo),
  }
  const textHex = {
    ok: hexFromTailwindArbitrary(ESTILOS.ok.textoSobreFondo),
    atencion: hexFromTailwindArbitrary(ESTILOS.atencion.textoSobreFondo),
    parar: ESTILOS.parar.textoSobreFondo === "text-white" ? "#ffffff" : hexFromTailwindArbitrary(ESTILOS.parar.textoSobreFondo),
  }

  it("keeps text/background contrast >= 7:1 (WCAG AAA) for all three states", () => {
    expect(contrastRatio(bgHex.ok, textHex.ok)).toBeGreaterThanOrEqual(7)
    expect(contrastRatio(bgHex.atencion, textHex.atencion)).toBeGreaterThanOrEqual(7)
    expect(contrastRatio(bgHex.parar, textHex.parar)).toBeGreaterThanOrEqual(7)
  })

  it("orders background luminance OK > ATENCIÓN > PARAR (grayscale-distinguishable)", () => {
    const lumOk = relativeLuminance(bgHex.ok)
    const lumAtencion = relativeLuminance(bgHex.atencion)
    const lumParar = relativeLuminance(bgHex.parar)
    expect(lumOk).toBeGreaterThan(lumAtencion)
    expect(lumAtencion).toBeGreaterThan(lumParar)
  })
})

/** Hue in degrees [0, 360) -- used only to confirm the J2 notification color
 * reads as visually distinct from PARAR's dark red, since luminance alone
 * (two very dark colors) would not show that on its own. */
function hue(hex: string): number {
  const normalized = normalizeHex(hex)
  const [r, g, b] = normalized
    .replace("#", "")
    .match(/\w\w/g)!
    .map((x) => parseInt(x, 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h: number
  switch (max) {
    case r:
      h = ((g - b) / d) % 6
      break
    case g:
      h = (b - r) / d + 2
      break
    default:
      h = (r - g) / d + 4
      break
  }
  h *= 60
  return h < 0 ? h + 360 : h
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

describe("J2: notification color (distinct from the D10 status palette, never a state)", () => {
  const bg = hexFromTailwindArbitrary(NOTIFICACION.fondo)
  const text = NOTIFICACION.texto === "text-white" ? "#ffffff" : hexFromTailwindArbitrary(NOTIFICACION.texto)
  const pararBg = hexFromTailwindArbitrary(ESTILOS.parar.fondo)

  it("keeps text/background contrast >= 7:1 (WCAG AAA, extra margin for glare)", () => {
    expect(contrastRatio(bg, text)).toBeGreaterThanOrEqual(7)
  })

  it("is not confusable with PARAR's dark red (distinct hue, distinct luminance)", () => {
    expect(hueDistance(hue(bg), hue(pararBg))).toBeGreaterThan(60)
    // Not required to match D10's OK > ATENCIÓN > PARAR luminance ordering
    // (this is not a 4th state) -- just meaningfully different from PARAR's
    // own luminance so the two dark fills don't read as the same color.
    expect(Math.abs(relativeLuminance(bg) - relativeLuminance(pararBg))).toBeGreaterThan(0.005)
  })
})

// --- Source scan -----------------------------------------------------------

function listSourceFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return []
  return fs
    .readdirSync(abs, { recursive: true })
    .map((f) => f.toString())
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map((f) => path.join(dir, f))
    .filter((f) => !f.includes(`${path.sep}ui${path.sep}`) && !f.startsWith(`components${path.sep}ui`))
    .filter((f) => !f.includes(".test."))
}

const SCANNED_FILES = [...listSourceFiles("components"), ...listSourceFiles("app")]

describe("Source scan: forbidden floor-rule violations (components/**, app/**, excluding ui/ and *.test.*)", () => {
  it.each(SCANNED_FILES)("%s has no forbidden pattern", (file) => {
    const content = fs.readFileSync(path.join(ROOT, file), "utf-8")
    const hits = scanForViolations(file, content)
    expect(hits, hits.join("\n")).toEqual([])
  })
})

describe("O-D3: office paths are exempt from floor-only rules but not the standard-scale rules", () => {
  it("recognizes app/oficina/** and components/oficina/** as office paths", () => {
    expect(isOfficePath("app/oficina/page.tsx")).toBe(true)
    expect(isOfficePath("components/oficina/sidebar.tsx")).toBe(true)
    expect(isOfficePath(path.join("app", "oficina", "alertas", "page.tsx"))).toBe(true)
  })

  it("does not treat plant-floor or other paths as office paths", () => {
    expect(isOfficePath("app/planta/page.tsx")).toBe(false)
    expect(isOfficePath("components/dashboard.tsx")).toBe(false)
    expect(isOfficePath("app/page.tsx")).toBe(false)
  })

  it("allows sub-24px named text size in an office file (floor-only rule exempted)", () => {
    const hits = scanForViolations("app/oficina/page.tsx", `<p className="text-sm">Hola</p>`)
    expect(hits).toEqual([])
  })

  it("allows muted/gray text in an office file (floor-only rule exempted)", () => {
    const hits = scanForViolations("components/oficina/kpi-card.tsx", `<span className="text-neutral-500">2.3%</span>`)
    expect(hits).toEqual([])
  })

  it("rejects lookalike prefixes that only share the leading letters, not a real office path (F1)", () => {
    expect(isOfficePath("app/oficinas-legacy/x.tsx")).toBe(false)
    expect(isOfficePath("components/oficina-foo.tsx")).toBe(false)
  })

  it("still forbids sub-24px named text size on a plant-floor file", () => {
    const hits = scanForViolations("app/planta/page.tsx", `<p className="text-sm">Hola</p>`)
    expect(hits.length).toBeGreaterThan(0)
  })

  it("still forbids an arbitrary pixel height in an office file (standard-scale rule not exempted)", () => {
    const hits = scanForViolations("app/oficina/page.tsx", `<div className="h-[88px]" />`)
    expect(hits.length).toBeGreaterThan(0)
  })

  it("still forbids an arbitrary pixel text size in an office file (standard-scale rule not exempted)", () => {
    const hits = scanForViolations("components/oficina/chart.tsx", `<span className="text-[13px]" />`)
    expect(hits.length).toBeGreaterThan(0)
  })
})

describe("D28 amendment: back office paths get the same exemption model as office (O-D3)", () => {
  it("recognizes app/backoffice/** and components/backoffice/** as backoffice paths", () => {
    expect(isBackofficePath("app/backoffice/page.tsx")).toBe(true)
    expect(isBackofficePath("components/backoffice/dashboard.tsx")).toBe(true)
    expect(isBackofficePath(path.join("app", "backoffice", "page.tsx"))).toBe(true)
  })

  it("does not treat plant-floor, office, or other paths as backoffice paths", () => {
    expect(isBackofficePath("app/planta/page.tsx")).toBe(false)
    expect(isBackofficePath("app/oficina/page.tsx")).toBe(false)
    expect(isBackofficePath("app/page.tsx")).toBe(false)
  })

  it("rejects lookalike prefixes that only share the leading letters, not a real backoffice path", () => {
    expect(isBackofficePath("app/backoffice-legacy/x.tsx")).toBe(false)
    expect(isBackofficePath("components/backoffice-foo.tsx")).toBe(false)
  })

  it("allows sub-24px named text size in a backoffice file (floor-only rule exempted)", () => {
    const hits = scanForViolations("app/backoffice/page.tsx", `<p className="text-sm">Hola</p>`)
    expect(hits).toEqual([])
  })

  it("allows muted/gray text in a backoffice file (floor-only rule exempted)", () => {
    const hits = scanForViolations("components/backoffice/dashboard.tsx", `<span className="text-neutral-500">2.3%</span>`)
    expect(hits).toEqual([])
  })

  it("still forbids an arbitrary pixel height in a backoffice file (standard-scale rule not exempted)", () => {
    const hits = scanForViolations("app/backoffice/page.tsx", `<div className="h-[88px]" />`)
    expect(hits.length).toBeGreaterThan(0)
  })
})

// --- Exact UI strings --------------------------------------------------------

function readAll(files: string[]): string {
  return files.map((f) => fs.readFileSync(path.join(ROOT, f), "utf-8")).join("\n")
}

describe("Guard sanity: the scanned file list is never empty (F6, fail closed)", () => {
  it("finds at least one source file under components/ and app/", () => {
    // A guard that silently scans zero files (e.g. a broken path, a renamed
    // directory) passes trivially and stops protecting anything. Fail
    // closed instead: an empty scan is itself a test failure.
    expect(SCANNED_FILES.length).toBeGreaterThan(0)
  })
})

describe("normalizeHex (F6)", () => {
  it("expands the 3-digit #rgb shorthand to 6-digit lowercase", () => {
    expect(normalizeHex("#0f0")).toBe("#00ff00")
  })

  it("lowercases an already 6-digit hex color", () => {
    expect(normalizeHex("#FF0000")).toBe("#ff0000")
  })

  it("rejects a hex string with the wrong number of digits", () => {
    expect(() => normalizeHex("#1234")).toThrow(/invalid hex color/i)
  })

  it("rejects a string with non-hex characters", () => {
    expect(() => normalizeHex("#zzzzzz")).toThrow(/invalid hex color/i)
  })

  it("rejects a string missing the leading #", () => {
    expect(() => normalizeHex("ff0000")).toThrow(/invalid hex color/i)
  })
})

describe("Exact UI strings (D7, D8)", () => {
  const stack = readAll(listSourceFiles("components").filter((f) => f.includes("alert-stack")))
  const detail = readAll(listSourceFiles("components").filter((f) => f.includes("alert-detail")))
  const allComponents = readAll(SCANNED_FILES)

  it('alert stack has the plural overflow phrase "alertas menos graves"', () => {
    expect(stack).toContain("alertas menos graves")
  })

  it('alert stack has the singular overflow phrase "alerta menos grave"', () => {
    expect(stack).toContain("alerta menos grave")
  })

  it('alert stack has the exact empty state "Sin alertas abiertas"', () => {
    expect(stack).toContain("Sin alertas abiertas")
  })

  it('alert detail has exactly the "Atendida" and "No aplica" actions', () => {
    expect(detail).toContain("Atendida")
    expect(detail).toContain("No aplica")
  })

  it('no component references the removed "Útil" feedback action', () => {
    expect(allComponents).not.toContain("Útil")
  })
})
