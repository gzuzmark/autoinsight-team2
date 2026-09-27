import path from "node:path"

// Rule engine behind lib/design-rules.test.ts's source scan (D4-D13, O-D3).
// Extracted into its own module so the office-path exemption (O-D3) can be
// unit-tested directly against synthetic content, instead of only through
// files that happen to exist on disk.

export type Rule = { name: string; pattern: RegExp }

/** Rules that encode the plant-floor-specific design rules (D11/D12): they
 * never apply to the office desk view (O-D3). */
export const FLOOR_ONLY_RULES: Rule[] = [
  { name: "opacity utility (D12: no opacity)", pattern: /\bopacity-\d+\b/ },
  {
    name: "alpha color suffix like /25 (D12: no alpha colors)",
    pattern: /\b(?:bg|text|border|ring|shadow|from|to|via)-[\w-]+\/\d{1,3}\b/,
  },
  { name: "transition utility (D12: no transitions)", pattern: /\btransition(?:-[\w-]+)?\b/ },
  { name: "animate- utility (D12: no animations)", pattern: /\banimate-[\w-]+\b/ },
  { name: "active:scale utility (D12: no press-scale motion)", pattern: /\bactive:scale-[\w-]+\b/ },
  { name: "tw-animate-css reference (D12: dependency removed)", pattern: /tw-animate-css/ },
  { name: "sub-24px named text size (D11: readable text >= 24px)", pattern: /\btext-(?:xs|sm|base|lg|xl)\b/ },
  {
    name: "muted/gray text color (D12: no letra apagada)",
    pattern: /\btext-neutral-[3-8]00\b|\btext-gray-\d{2,3}\b/,
  },
]

/** Rules that enforce the standard Tailwind scale (no arbitrary pixel
 * values). These apply everywhere, including the office desk view: O-D3
 * exempts office paths from the floor-only rules above, never from this. */
export const STANDARD_SCALE_RULES: Rule[] = [
  {
    name: "arbitrary text size (use the standard Tailwind text-* scale only)",
    pattern: /text-\[(?!#)[^\]]*\]/,
  },
  {
    name: "arbitrary width/height/size utility (use the standard spacing scale only)",
    pattern: /\b(?:min-w|max-w|min-h|max-h|w|h|size)-\[[^\]]+\]/,
  },
]

export const ALL_RULES: Rule[] = [...FLOOR_ONLY_RULES, ...STANDARD_SCALE_RULES]

/** O-D3: the office desk view (and its components) is exempt from the
 * floor-only rules -- it is read at a desk, not glanced at on a tablet with
 * gloves on. Path check works for both "app/oficina/..." (POSIX, as used in
 * import specifiers and test fixtures) and the OS-specific separator that
 * `path.join` produces when walking the real filesystem. */
export function isOfficePath(file: string): boolean {
  const normalized = file.split(path.sep).join("/")
  return (
    normalized === "app/oficina" ||
    normalized.startsWith("app/oficina/") ||
    normalized === "components/oficina" ||
    normalized.startsWith("components/oficina/")
  )
}

export function rulesForFile(file: string): Rule[] {
  return isOfficePath(file) ? STANDARD_SCALE_RULES : ALL_RULES
}

/** Scans one file's content against the rules applicable to its path,
 * returning one formatted "file:line: rule -> line" string per hit. */
export function scanForViolations(file: string, content: string): string[] {
  const rules = rulesForFile(file)
  const lines = content.split("\n")
  const hits: string[] = []
  for (const rule of rules) {
    lines.forEach((line, i) => {
      if (rule.pattern.test(line)) {
        hits.push(`${file}:${i + 1}: ${rule.name} -> "${line.trim().slice(0, 100)}"`)
      }
    })
  }
  return hits
}
