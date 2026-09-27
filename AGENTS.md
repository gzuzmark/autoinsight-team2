<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Floor design rules

This app is a plant-floor quality dashboard (tablet, gloves, glare, <5s
glance). The product rules below (D4-D13, decided 2026-09-25; D27-D29,
Phase E, 2026-09-26; see `odd/tasks/autoinsight-port.md`) are load-bearing:
any change that violates one is a regression, not a style preference.

The app is mobile-first and responsive (D27): the exact "no scroll"
1280x800 tablet geometry only applies at kiosk size (the `kiosk:` Tailwind
variant, `min-width: 1280px` AND `min-height: 800px`, declared once in
`app/globals.css`) — below that the page scrolls vertically like an
ordinary page. The floor rules (text ≥ 24px, touch targets ≥ 88px, color +
shape + word, no opacity/transitions/animations) apply at EVERY size, kiosk
or not. See the README "Responsive layout and kiosk mode" section.

The plant-floor tablet app lives at `/planta` (moved from `/`, O-D1); `/` is
now the view selector and still follows the floor rules (it is the tablet's
entry point). `/oficina/**` is a separate desk view (Resumen, alert
investigation, Reportes) and is exempt from the floor-only rules D5/D11/D12
(no numeric KPI values, 24px text, 88px targets, no gray text) — see
`odd/tasks/autoinsight-office.md` (O-D3) — but still follows the standard
Tailwind scale below.

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
corepack pnpm test:ui                         # BASE_URL defaults to :3100; checks 4 viewports
git diff --check                              # whitespace/conflict markers
```

`DATA_SOURCE` defaults to `mock` and needs no other setup; see the README
"Environment variables" section for the full table and for running the same
check against a local Supabase stack instead (`DATA_SOURCE=supabase` in
`.env.local`). Shift simulation (E3/D28) is triggered from Supabase only now
(SQL function or the `demo_panel` Table Editor row) — see the README
"Simulate a shift (demo)" section.

When a change touches `supabase/**`, also run (local Docker stack only,
never the remote project — see the README "Supabase (local)" section):

```bash
supabase db reset --local && supabase test db
supabase db advisors --local     # expect 0 issues
corepack pnpm db:types:check     # fails if lib/supabase/database.types.ts is stale
```

`corepack pnpm db:types` regenerates `lib/supabase/database.types.ts` from
the local schema (`supabase gen types typescript --local`); run it and
commit the result whenever a migration changes tables, columns, enums, or
function signatures. `db:types:check` (`scripts/check-db-types.mjs`)
regenerates the types to a temp file and diffs them against the committed
file, failing (non-zero exit) on drift instead of silently leaving stale
types in the tree.

`test:run` includes `lib/design-rules.test.ts`, a static guard that scans
`components/**` and `app/**` (excluding `components/ui/**` and `*.test.*`)
for forbidden patterns (including the `kiosk:` variant staying within the
standard Tailwind scale) and checks the status palette's contrast/luminance
programmatically. `test:ui` (`scripts/ui-check.mjs`, E2) drives a real
Chrome through login/PIN/dashboard/detail/second-visit/resolve-an-alert at
four viewports — kiosk (1280x800, strict "no document scroll at all"),
MacBook (1512x790), tablet portrait (768x1024) and phone (390x844) — and
fails on horizontal overflow, document scroll at kiosk size, text under
24px, touch targets under 88px, clipped content, an alert card/overflow
line that cannot be scrolled into view, or console errors. It also runs one
non-viewport-specific scenario (E4) that triggers a shift from OUTSIDE the
app (a direct DB call via `UI_CHECK_DB_CONTAINER`) and asserts the
dashboard auto-refreshes with no click; it is skipped with a notice when
that env var is unset. Every change must pass `test:run` and `test:ui`
before commit.

## D4-D13 checklist

- [ ] D4: avatar + PIN login kept (no plain keyboard-only login).
- [ ] D5: KPI tiles show only KPI name + state word + shape icon — **no
      numeric value**.
- [ ] D6: header shows plant name + "Última actualización HH:MM"; no
      ACTUALIZAR button — the dashboard auto-refreshes every 15s instead
      (D29).
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
      `min-h-22` / `h-22` etc.) — at every screen size, not only kiosk (E1).
- [ ] D12: no `opacity-*`, no alpha colors (`/NN` suffix), no
      `transition-*`, no `animate-*`, no `active:scale-*`; no muted/gray
      text (`text-neutral-300..800`, `text-gray-*`) — every visible letter
      is near-black (`text-neutral-900`) or the palette's own high-contrast
      color, never gray.
- [ ] D13: the detail panel has `role="dialog"` `aria-modal="true"`
      `aria-labelledby`, initial focus on open, Escape closes, and focus
      returns to the alert that opened it.

## D27-D29 checklist (Phase E: responsive, kiosk, Supabase-triggered shifts)

- [ ] D27: base styles are mobile-first; the fixed no-scroll 1280x800
      geometry only applies under the `kiosk:` variant (`min-width: 1280px`
      AND `min-height: 800px`); below kiosk size the page scrolls vertically
      and never overflows horizontally or clips content; D4-D13 still hold
      at every size.
- [ ] D28: no in-app shift simulation (no button, no `?demo=1`, no
      `DEMO_ENABLED`, no `/api/demo/simular`); a shift is triggered only
      from Supabase — `demo_simular_turno_linea(linea, cantidad)` or the
      `demo_panel` Table Editor row — both delegating to the same
      `private.simular_turno_en_linea` the removed button used.
- [ ] D29: the dashboard auto-refreshes `GET /api/tablero` every 15s while
      logged in and the tab is visible (Page Visibility API; paused when
      hidden, refetches on becoming visible); no overlapping requests; no
      flicker; stops on logout; a 401 during a poll returns to login
      cleanly (no error banner, no stale dashboard).

## Standard Tailwind scale only

No arbitrary pixel values for size or spacing anywhere in `components/**` or
`app/**` (`components/ui/**` — third-party shadcn primitives — and
`*.test.*` files are exempt). This applies to `app/oficina/**` and
`components/oficina/**` too: they are exempt from the floor-only rules (min
text size, gray text) but not from the standard scale. Use the standard scale. Breakpoint variants
(`md:`, `lg:`, …) and the `kiosk:` custom variant are fine to combine with
any of these — only the underlying value must stay on the standard scale
(e.g. `kiosk:grid-cols-3`, `kiosk:h-22` are fine; `kiosk:h-[88px]` is not):

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
