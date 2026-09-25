import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { ESTILOS } from "./status"

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

type Rule = { name: string; pattern: RegExp }

const FORBIDDEN_RULES: Rule[] = [
  { name: "opacity utility (D12: no opacity)", pattern: /\bopacity-\d+\b/ },
  {
    name: "alpha color suffix like /25 (D12: no alpha colors)",
    pattern: /\b(?:bg|text|border|ring|shadow|from|to|via)-[\w-]+\/\d{1,3}\b/,
  },
  { name: "transition utility (D12: no transitions)", pattern: /\btransition(?:-[\w-]+)?\b/ },
  { name: "animate- utility (D12: no animations)", pattern: /\banimate-[\w-]+\b/ },
  { name: "active:scale utility (D12: no press-scale motion)", pattern: /\bactive:scale-[\w-]+\b/ },
  { name: "tw-animate-css reference (D12: dependency removed)", pattern: /tw-animate-css/ },
  {
    name: "arbitrary text size (use the standard Tailwind text-* scale only)",
    pattern: /text-\[(?!#)[^\]]*\]/,
  },
  { name: "sub-24px named text size (D11: readable text >= 24px)", pattern: /\btext-(?:xs|sm|base|lg|xl)\b/ },
  {
    name: "muted/gray text color (D12: no letra apagada)",
    pattern: /\btext-neutral-[3-8]00\b|\btext-gray-\d{2,3}\b/,
  },
  {
    name: "arbitrary width/height/size utility (use the standard spacing scale only)",
    pattern: /\b(?:min-w|max-w|min-h|max-h|w|h|size)-\[[^\]]+\]/,
  },
]

describe("Source scan: forbidden floor-rule violations (components/**, app/**, excluding ui/ and *.test.*)", () => {
  it.each(SCANNED_FILES)("%s has no forbidden pattern", (file) => {
    const content = fs.readFileSync(path.join(ROOT, file), "utf-8")
    const lines = content.split("\n")
    const hits: string[] = []
    for (const rule of FORBIDDEN_RULES) {
      lines.forEach((line, i) => {
        if (rule.pattern.test(line)) {
          hits.push(`${file}:${i + 1}: ${rule.name} -> "${line.trim().slice(0, 100)}"`)
        }
      })
    }
    expect(hits, hits.join("\n")).toEqual([])
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
