<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Floor design rules

This app is a plant-floor quality dashboard (tablet, 1280x800, gloves, glare,
<5s glance). The product rules below (D4-D13, decided 2026-09-25, see
`odd/tasks/autoinsight-port.md`) are load-bearing: any change that violates
one is a regression, not a style preference.

## Stack

Next 16.3.3 (App Router), React 19, TypeScript 5.7 strict, Tailwind 4,
pnpm via `corepack pnpm`, Vitest 5 (node env, `@/` alias).

`next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so
`corepack pnpm build` does **not** type-check the project.
`corepack pnpm exec tsc --noEmit` is the real type gate and must be run
separately.

## Verification (run before every commit)

```bash
corepack pnpm test:run                       # unit tests + design-rules guard
corepack pnpm exec tsc --noEmit               # real type gate
corepack pnpm build                           # production build
corepack pnpm dev --port 3100 &               # dev server for the browser check
corepack pnpm test:ui                         # BASE_URL defaults to :3100
git diff --check                              # whitespace/conflict markers
```

`test:run` includes `lib/design-rules.test.ts`, a static guard that scans
`components/**` and `app/**` (excluding `components/ui/**` and `*.test.*`)
for forbidden patterns and checks the status palette's contrast/luminance
programmatically. `test:ui` (`scripts/ui-check.mjs`) drives a real Chrome at
1280x800 through login/PIN/dashboard/detail/second-visit/shift-simulation and
fails on document scroll, text under 24px, touch targets under 88px, clipped
content, or console errors. Every change must pass both before commit.

## D4-D13 checklist

- [ ] D4: avatar + PIN login kept (no plain keyboard-only login).
- [ ] D5: KPI tiles show only KPI name + state word + shape icon — **no
      numeric value**.
- [ ] D6: header shows plant name + "Última actualización HH:MM"; no
      ACTUALIZAR button (deferred to T9, no server data yet).
- [ ] D7: alert detail stays full-screen with exactly two actions —
      "Atendida" and "No aplica" — both close the panel immediately, no
      confirmation, no thanks message, no "Útil"/"No útil".
- [ ] D8: alert severity words are ALTA/MEDIA/BAJA (not the OK/ATENCIÓN/PARAR
      status word); unseen alerts get a solid dot; overflow text is exactly
      "+N alertas menos graves" ("+1 alerta menos grave" singular); empty
      state is exactly "Sin alertas abiertas".
- [ ] D9: since-last-visit is an inline strip (never an overlay/modal),
      hidden on first visit, up to 3 lines, "Sin cambios desde tu última
      visita, HH:MM" when nothing changed.
- [ ] D10: status palette is OK (very light green / dark green text),
      ATENCIÓN (intense amber / black text), PARAR (very dark red / white
      text); background luminance strictly OK > ATENCIÓN > PARAR.
- [ ] D11: every readable text >= 24px (`text-2xl`), state/severity words
      >= 48px (`text-5xl`), every touch target >= 88x88px (`size-22` /
      `min-h-22` / `h-22` etc.).
- [ ] D12: no `opacity-*`, no alpha colors (`/NN` suffix), no
      `transition-*`, no `animate-*`, no `active:scale-*`; no muted/gray
      text (`text-neutral-300..800`, `text-gray-*`) — every visible letter
      is near-black (`text-neutral-900`) or the palette's own high-contrast
      color, never gray.
- [ ] D13: the detail panel has `role="dialog"` `aria-modal="true"`
      `aria-labelledby`, initial focus on open, Escape closes, and focus
      returns to the alert that opened it.

## Standard Tailwind scale only

No arbitrary pixel values for size or spacing anywhere in `components/**` or
`app/**` (`components/ui/**` — third-party shadcn primitives — and
`*.test.*` files are exempt). Use the standard scale:

- Font size: `text-2xl` (24px, minimum readable text) up to `text-5xl`
  (48px, state/severity words); never `text-[Npx]`, never
  `text-xs`/`sm`/`base`/`lg`/`xl`.
- Width/height/spacing: plain numeric scale utilities such as `size-22` /
  `min-h-22` (88px, glove touch target), `size-24` (96px), `h-14` (56px),
  `w-70` (280px), `max-w-225` (900px) — never `h-[88px]`, `w-[280px]`,
  `min-h-[96px]`, `max-w-[900px]`.
- Arbitrary **hex colors** in `lib/status.tsx` are allowed (the palette is
  validated by the contrast/luminance test, not by a class-name pattern);
  prefer the existing palette constants elsewhere.

`lib/design-rules.test.ts` enforces this with a source scan; a violation
fails `test:run`.
