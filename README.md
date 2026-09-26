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
To try the shift-simulation demo button, add `?demo=1` to the URL (also
requires `DEMO_ENABLED=true` on the server — see "Environment variables"
below; without it, the button posts to a route that 404s).

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
under 24px, touch targets under 88px, clipped content, or console errors. The
shift-simulation scenario needs the dev server started with
`DEMO_ENABLED=true` (see below); `test:ui` runs the same way against either
data source (`DATA_SOURCE=mock`, the default, or `DATA_SOURCE=supabase`
against a running local stack).

## Environment variables

Copy `.env.example` to `.env.local` (gitignored) and fill in real values —
never commit `.env.local` or a real `SUPABASE_SECRET_KEY`.

| Variable | Values | Default | Notes |
| --- | --- | --- | --- |
| `DATA_SOURCE` | `mock` \| `supabase` | `mock` | Selects the `FloorRepository` adapter (D19, T7). `mock` needs nothing else below and reproduces the app's existing in-memory behavior (same users/PINs, same seed alerts) with no backend running. |
| `SUPABASE_URL` | URL | — | Required only when `DATA_SOURCE=supabase`. Read server-side only (D20) — never sent to the browser, never `NEXT_PUBLIC_*`. Local value: `supabase status -o env` after `supabase start`. |
| `SUPABASE_SECRET_KEY` | secret | — | Required only when `DATA_SOURCE=supabase`; the `service_role`/`sb_secret` key. Same source as above. Never commit a real value. |
| `DEMO_ENABLED` | `true` \| anything else | disabled | Enables `POST /api/demo/simular` (D23); every other value 404s the route, so the "Simular turno" button (`?demo=1`) does nothing server-side unless this is exactly `"true"`. |

To run the app against a local Supabase stack instead of mock data:

```bash
supabase start                 # first run downloads Docker images
supabase status -o env         # copy the API URL and service_role key into .env.local
```

Then in `.env.local`:

```
DATA_SOURCE=supabase
SUPABASE_URL=<API URL from supabase status>
SUPABASE_SECRET_KEY=<service_role key from supabase status>
```

Restart `corepack pnpm dev --port 3100` after changing `.env.local` (env vars
are read once at server start).

## Supabase (local)

The backend schema lives under `supabase/` (Supabase CLI, Docker). This is a
clean rewrite (D15) of the app's Postgres schema, not derived from the
legacy remote schema: Spanish identifiers matching the app's own contracts
(D16), RLS enabled on every table with no anon/authenticated policies, and
every RPC restricted to `service_role` (D17). The app is wired to it (T7-T9)
behind the `DATA_SOURCE` environment variable — see "Environment variables"
above; `DATA_SOURCE=mock` (the default) needs none of the commands below.

```bash
supabase start                          # first run downloads Docker images
supabase db reset                       # (re)applies migrations + seed.sql
supabase test db                        # runs the pgTAP suite in supabase/tests/
supabase db advisors --local            # security/perf lint, expect 0 issues
corepack pnpm db:types                  # regenerate lib/supabase/database.types.ts
corepack pnpm db:types:check            # fails (non-zero) if committed types are stale
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

Login lockout: 5 consecutive wrong PINs lock a user out for
`private.duracion_bloqueo()` (5 minutes); a lock that has already expired
resets the failure counter, so the next attempt starts from zero again
instead of relocking on a single new failure. Each *consecutive* lock (one
that follows a previous lock with no successful login or admin unlock in
between) lasts longer than the last: `private.duracion_bloqueo_escalada(n)`
doubles the base 5 minutes for every prior consecutive lock
(`intentos_login.bloqueos` tracks `n`), capped at
`private.duracion_bloqueo_maxima()` (60 minutes) — 5 min, 10 min, 20 min, …,
60 min. `bloqueos` resets to 0 on a successful login or an admin unlock, but
*not* when a lock merely expires, so repeated lock cycles still escalate.
`public.desbloquear_usuario(p_usuario_id)` (service_role only) clears a
lockout immediately and resets both counters, for an admin/demo unlock:

```sql
select public.desbloquear_usuario('<usuario_id>'); -- as service_role
```

Per-client/IP request throttling (rate-limiting the login route itself) is
not a database concern and belongs to the Next.js route handlers: `POST
/api/sesion` (`lib/api/login-throttle.ts`, T8) rejects with 429 after 10
attempts/minute from the same client (`x-forwarded-for` first hop, or a
single shared fallback bucket when absent). This is in-memory per server
instance — on serverless with multiple instances it only bounds guesses per
instance, not globally; a shared store (e.g. Redis) would be needed for a
real multi-instance deployment, which is out of scope here.

Cutover to the remote project (`urxhacdnqgllscijffmh`) — applying these
migrations there, seeding it, and enabling cron — is a separate, explicitly
authorized step (B8), not part of local development.

`alertas_linea_titulo_nueva_uidx` (migration
`20260925000005_demo_alertas_dedupe_index.sql`) assumes a clean database at
the point it is created: it only prevents *future* duplicate active alerts
per `(linea_id, titulo)`, it cannot retroactively deduplicate rows that
already violate it. B8 cutover must apply migrations to a database with no
pre-existing active-alert duplicates on that pair (true for the clean
rewrite this schema ships as); applying it to a database that already has
such duplicates fails the migration outright (unique index creation).

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
| "Última actualización HH:MM" | 24h HH:MM in the tablet's local time zone; now server-provided (`tablero.ultimaActualizacion`, T9) instead of the client's login/simulate clock | Gives a trust signal for data freshness tied to the actual data, not the client's local timer. |
| No manual ACTUALIZAR button | Still not added in T9: the dashboard refetches `tablero` after login and after every action (attend/dismiss/simulate, D22), but nothing polls or lets the operator force a refresh mid-visit | Open product decision, not settled by D19-D23: is a manual refresh needed now that there is real server data, or is action-triggered refetch enough for the floor's <5s-glance use case? Left for a future decision, see the report handed back with this change. |
| "Atendida" / "No aplica", no confirmation | Two full-width buttons, both close the detail panel immediately; detail header shows the severity word (ALTA/MEDIA/BAJA) with the same icon/color as the stack; location + time at `text-4xl` (36px, ≥ 32px) | A confirmation dialog or a "thanks" message costs an extra tap and a second glance the operator doesn't have time for; showing a different word in the header than in the stack made the operator re-check they'd opened the right alert. |
| Avatar + PIN login kept | 4-digit PIN pad, no physical keyboard | Explicit trade-off: costs ~4 extra taps versus a single badge/tap login, but there is no keyboard on the floor tablet and this matches the existing product's login model. |
| No opacity, transitions or animation | All `opacity-*`, alpha colors, `transition-*`, `active:scale-*`, `animate-*` removed; `tw-animate-css` dropped | Motion and translucency read as noise under glare and cost attention the glance budget doesn't allow; state changes should be instant and certain. Enforced by `lib/design-rules.test.ts`. |
| No scroll, no clipping at 1280×800 | Dashboard (first and second visit), login, PIN pad, alert detail and the post-shift-simulation dashboard all fit the viewport with zero document scroll and zero clipped content | A scrollbar or a silently clipped card hides alerts below the fold, which is unacceptable for a screen whose job is "show me what's wrong right now". Verified by `corepack pnpm test:ui` against a real Chrome, not just unit tests. |

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
