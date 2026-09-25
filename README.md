# autoinsight-team2

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_d4l8RMINOnNtDh2Nl6HhfwPQaR8D)

## Getting Started

Install dependencies, then run the development server (port 3100, since 3000
may already be taken on your machine):

```bash
corepack pnpm install
corepack pnpm dev --port 3100
```

Open [http://localhost:3100](http://localhost:3100) with your browser to see the result.
To try the shift-simulation demo button, add `?demo=1` to the URL.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

Before committing, run:

```bash
corepack pnpm test:run                # unit tests + lib/design-rules.test.ts guard
corepack pnpm exec tsc --noEmit
corepack pnpm build
corepack pnpm dev --port 3100 &       # needed by test:ui below
corepack pnpm test:ui                 # real-browser check at 1280x800, BASE_URL defaults to :3100
git diff --check
```

`next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `corepack pnpm build`
does **not** type-check the project — `tsc --noEmit` is the real type gate and
must be run separately.

`corepack pnpm test:ui` (`scripts/ui-check.mjs`, Playwright driving system
Chrome — no browser download) exercises login, PIN, dashboard (first visit),
alert detail, dashboard (second visit / since-last-visit strip) and dashboard
after the `?demo=1` shift simulation, and fails on document scroll, text
under 24px, touch targets under 88px, clipped content, or console errors.

## Supabase (local)

The backend schema lives under `supabase/` (Supabase CLI, Docker). This is a
clean rewrite (D15) of the app's Postgres schema, not derived from the
legacy remote schema: Spanish identifiers matching the app's own contracts
(D16), RLS enabled on every table with no anon/authenticated policies, and
every RPC restricted to `service_role` (D17). The app itself is not wired to
Supabase yet — the client data layer (T7-T9) is a separate, later change.

```bash
supabase start                          # first run downloads Docker images
supabase db reset                       # (re)applies migrations + seed.sql
supabase test db                        # runs the pgTAP suite in supabase/tests/
supabase gen types typescript --local > lib/supabase/database.types.ts
supabase stop                           # keeps the data volume; add --no-backup to also drop it
```

All of the above run against the **local** stack only (`--local`/no flags);
none of them touch the remote project. `supabase status` prints the local API
URL, DB connection string, and anon/service_role keys (well-known local
defaults, safe to keep out of committed files but not sensitive to print).

Seed data (`supabase/seed.sql`, loaded automatically by `db reset`): one
plant ("Planta Norte"), 3 lines, stations, the 6 mock users from
`lib/mock-data.ts` (PINs hashed with bcrypt at seed time), per-line KPIs,
and Línea 3's starting alerts matching `ALERTAS_INICIALES`.

To generate demo traffic by hand (no cron needed):

```sql
select public.demo_generar_alertas(null, 1); -- as service_role, e.g. via `supabase db psql`
select public.demo_autoresolver('30 minutes');
```

An **opt-in** cron job that calls those same two functions on a schedule is
in `supabase/snippets/cron_demo.sql` (not a migration — see the comment at
its top for why). Run it manually against the local DB, or paste it into
Dashboard → Integrations → Cron on a remote project after the B8 cutover.

Access model (D17): the browser never talks to Supabase directly. Next.js
route handlers (server-side) use the `service_role` (secret) key; `anon` and
`authenticated` have zero table privileges and zero `EXECUTE` on any RPC.

Cutover to the remote project (`urxhacdnqgllscijffmh`) — applying these
migrations there, seeding it, and enabling cron — is a separate, explicitly
authorized step (B8), not part of local development.

## Design decisions for the plant floor

This UI was ported from an office-style quality dashboard to run on a tablet
mounted on the assembly line floor. Discovery with plant managers and
quality/warranty engineers found that the office dashboard failed on the
floor: operators glance at it for under 5 seconds between tasks, often
wearing gloves, under direct light or glare that washes out subtle colors and
small text. Every decision below optimizes for that glance, not for
information density.

| Decision | Value | Why |
| --- | --- | --- |
| Three-channel state | color + shape icon + word (never color alone) | Readable under glare and by color-blind operators; a washed-out screen still shows the icon shape and the word. |
| State palette | OK bg `#e7f8ec` / text `#0a3d1f` (11.20:1, luminance 0.90) · ATENCIÓN bg `#ffb703` / text `#0a0800` (11.48:1, luminance 0.55) · PARAR bg `#3d0106` / text `#ffffff` (17.42:1, luminance 0.01) | All three pass WCAG AAA (≥ 7:1) and their relative luminance is clearly separated (high/mid/low), so the states stay distinguishable even in grayscale or with reflections. Checked by `lib/design-rules.test.ts`. |
| Severity word vs. status word | Alert stack/detail use ALTA/MEDIA/BAJA (severity); KPI tiles and the empty state use OK/ATENCIÓN/PARAR (status) — never mixed for the same alert | The alert screens answer "how bad?"; the KPI screens answer "is this metric OK?" — using one word for both hid which question was being answered. |
| State/severity word size | `text-5xl` = 48px | Legible at arm's length in a single glance. |
| Readable text size | `text-2xl` = 24px minimum, everywhere, always near-black (`text-neutral-900`), never a gray/muted shade | Nothing readable falls below comfortable glance-reading size, and dimming text for "secondary" info costs contrast the floor can't spare. |
| Touch targets | `size-22` / `min-h-22` / `h-22` = 88px minimum (Salir, Volver, demo button, alert cards, PIN keys, login avatars) | Reliable with work gloves; small targets cause mis-taps under time pressure. |
| Standard Tailwind scale only | No arbitrary `text-[Npx]`, `h-[Npx]`, `w-[Npx]` etc. anywhere in `components/**`/`app/**` (except `components/ui`, third-party shadcn primitives) | A fixed, guarded vocabulary (`text-2xl`…`text-5xl`, `size-22`, `size-24`, `h-14`, `w-70`, `max-w-225`, …) is easy to scan for compliance and prevents "just this once" one-off pixel values from drifting off the accessible scale. Enforced by `lib/design-rules.test.ts`. |
| KPI tiles show no numbers | KPI name + state word + shape symbol only, no raw value | A bare number ("88.4%") needs interpretation time the floor doesn't have; the state word answers "is this OK?" directly. |
| Top alert is tallest, largest font; secondary alerts are single-row | Top card: `min-h-35` (140px) and grows with spare space, `text-5xl` severity word. Secondary cards: fixed `h-22` (88px), one row (icon + severity + title + station + time), title `truncate`s instead of wrapping | A flex-ratio layout inside `overflow-hidden` let secondary cards shrink below their content and clip text at the worst-case size (strip + 3 alerts + overflow line); fixed/min heights with no ratio-based shrinking guarantee every line of every visible card stays fully readable. Checked by `scripts/ui-check.mjs` (no clipped content). |
| Alert stack capped at 3 + overflow line | "+N alertas menos graves" (singular "+1 alerta menos grave"), fixed `h-14` row | Keeps the highest-severity items on screen without a scrolling list; the overflow line still discloses that lower-severity alerts exist. |
| Unseen-alert dot | Solid dot + sr-only "Nueva" on alerts not seen at this user's last logout; no dot on first visit | Gives a returning operator a fast visual diff without reading every card; a first-time user has no prior baseline to diff against. |
| Since-last-visit strip | Compact inline strip between header and KPI tiles (heading inline with the first line, up to 3 short lines total), hidden on first visit; "Sin cambios desde tu última visita, HH:MM" when nothing changed | An inline strip that never blocks the alert stack respects the <5s budget; a modal or overlay would cost an extra tap and hide the very screen the operator opened the app for. |
| Single-row compact header | Plant name · line · shift · "Última actualización HH:MM" all `whitespace-nowrap` on one line; user name, avatar, demo button and Salir stay on the right | Keeps the header's vertical budget small and predictable so the alert stack below it always has enough room at 1280×800 without scrolling. |
| "Última actualización HH:MM" | 24h HH:MM in the tablet's local time zone, set on login and on shift simulation | Gives a trust signal for data freshness without a fake refresh action. |
| No manual ACTUALIZAR button | Deferred to T9 (client data layer / API wiring) | With mock, static data, a refresh button that does nothing erodes trust faster than no button at all; it returns once there is real server data to fetch. |
| "Atendida" / "No aplica", no confirmation | Two full-width buttons, both close the detail panel immediately; detail header shows the severity word (ALTA/MEDIA/BAJA) with the same icon/color as the stack; location + time at `text-4xl` (36px, ≥ 32px) | A confirmation dialog or a "thanks" message costs an extra tap and a second glance the operator doesn't have time for; showing a different word in the header than in the stack made the operator re-check they'd opened the right alert. |
| Avatar + PIN login kept | 4-digit PIN pad, no physical keyboard | Explicit trade-off: costs ~4 extra taps versus a single badge/tap login, but there is no keyboard on the floor tablet and this matches the existing product's login model. |
| No opacity, transitions or animation | All `opacity-*`, alpha colors, `transition-*`, `active:scale-*`, `animate-*` removed; `tw-animate-css` dropped | Motion and translucency read as noise under glare and cost attention the glance budget doesn't allow; state changes should be instant and certain. Enforced by `lib/design-rules.test.ts`. |
| No scroll, no clipping at 1280×800 | Dashboard (first and second visit), login, PIN pad, alert detail and the post-shift-simulation dashboard all fit the viewport with zero document scroll and zero clipped content | A scrollbar or a silently clipped card hides alerts below the fold, which is unacceptable for a screen whose job is "show me what's wrong right now". Verified by `corepack pnpm test:ui` against a real Chrome, not just unit tests. |

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
