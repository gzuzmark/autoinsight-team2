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

## Routes

- `/` -- view selector ("¿Cómo vas a trabajar hoy?"): choose Oficina or Planta.
  Follows the plant-floor design rules (it is the tablet's entry point).
- `/planta` -- the plant-floor tablet app (login, PIN, dashboard, alerts). This
  is the app that used to live at `/`; floor tablets must be pointed at
  `/planta` directly. You can start editing it by modifying `app/planta/page.tsx`.
- `/oficina` -- office desk view: Resumen de planta (KPIs, FPY trend, defect
  Pareto, alert heatmap, latest alerts). Not subject to the floor design rules
  (D5/D11/D12) -- see `app/oficina/**` and `components/oficina/**`.
- `/oficina/alertas/[id]` -- alert investigation screen (static sample data).
- `/oficina/reportes` -- report list and "Programar reporte" form.

The page auto-updates as you edit the file.

Before committing, run:

```bash
corepack pnpm test:run                # unit tests + lib/design-rules.test.ts guard
corepack pnpm exec tsc --noEmit
corepack pnpm build
corepack pnpm dev --port 3100 &       # needed by test:ui below
corepack pnpm test:ui                 # real-browser check at 4 viewports, BASE_URL defaults to :3100
git diff --check
```

`next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `corepack pnpm build`
does **not** type-check the project — `tsc --noEmit` is the real type gate and
must be run separately.

`corepack pnpm test:ui` (`scripts/ui-check.mjs`, Playwright driving system
Chrome — no browser download) exercises login, PIN, dashboard (first visit),
alert detail, dashboard (second visit / since-last-visit strip) and dashboard
after resolving an alert on `/planta`, at four viewports (kiosk 1280x800,
MacBook 1512x790, tablet portrait 768x1024, phone 390x844), and fails on
horizontal overflow, document scroll at kiosk size, text under 24px, touch
targets under 88px, clipped content, an unreachable alert card/overflow line,
or console errors. It runs the same way against either data source
(`DATA_SOURCE=mock`, the default, or `DATA_SOURCE=supabase` against a running
local stack). It also runs an office smoke (`/`, `/oficina`,
`/oficina/alertas/<id>`, `/oficina/reportes`) that checks for horizontal
overflow, console errors, and the three navigation links between the
selector, office, and floor apps -- office pages are not held to the floor's
24px/88px rules.

## Environment variables

Copy `.env.example` to `.env.local` (gitignored) and fill in real values —
never commit `.env.local` or a real `SUPABASE_SECRET_KEY`.

| Variable | Values | Default | Notes |
| --- | --- | --- | --- |
| `DATA_SOURCE` | `mock` \| `supabase` | `mock` | Selects the `FloorRepository` adapter (D19, T7). `mock` needs nothing else below and reproduces the app's existing in-memory behavior (same users/PINs, same seed alerts) with no backend running. |
| `SUPABASE_URL` | URL | — | Required only when `DATA_SOURCE=supabase`. Read server-side only (D20) — never sent to the browser, never `NEXT_PUBLIC_*`. Local value: `supabase status -o env` after `supabase start`. |
| `SUPABASE_SECRET_KEY` | secret | — | Required only when `DATA_SOURCE=supabase`; the `service_role`/`sb_secret` key. Same source as above. Never commit a real value. |

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
| Touch targets | `size-22` / `min-h-22` / `h-22` = 88px minimum (Salir, Volver, alert cards, PIN keys, login avatars) at every screen size (E1) | Reliable with work gloves; small targets cause mis-taps under time pressure. |
| Standard Tailwind scale only | No arbitrary `text-[Npx]`, `h-[Npx]`, `w-[Npx]` etc. anywhere in `components/**`/`app/**` (except `components/ui`, third-party shadcn primitives) | A fixed, guarded vocabulary (`text-2xl`…`text-5xl`, `size-22`, `size-24`, `h-14`, `w-70`, `max-w-225`, …) is easy to scan for compliance and prevents "just this once" one-off pixel values from drifting off the accessible scale. Enforced by `lib/design-rules.test.ts`. |
| KPI tiles show no numbers | KPI name + state word + shape symbol only, no raw value | A bare number ("88.4%") needs interpretation time the floor doesn't have; the state word answers "is this OK?" directly. |
| Top alert is tallest, largest font; secondary alerts are single-row at kiosk size | Top card: `min-h-35` (140px) and grows with spare space, `text-5xl` severity word. Secondary cards: `kiosk:h-22` (88px) single row with `kiosk:truncate`; below kiosk size (E1) they use `min-h-22` and wrap the title onto a second line instead of truncating it, since a small screen has room to scroll but a cut-off title is more misleading there | A flex-ratio layout inside `overflow-hidden` let secondary cards shrink below their content and clip text at the worst-case size (strip + 3 alerts + overflow line); fixed/min heights with no ratio-based shrinking guarantee every line of every visible card stays fully readable. Checked by `scripts/ui-check.mjs` (no clipped content, at every viewport). |
| Alert stack capped at 3 + overflow line | "+N alertas menos graves" (singular "+1 alerta menos grave"), fixed `h-14` row | Keeps the highest-severity items on screen without a scrolling list; the overflow line still discloses that lower-severity alerts exist. |
| Unseen-alert dot | Solid dot + sr-only "Nueva" on alerts not seen at this user's last logout; no dot on first visit | Gives a returning operator a fast visual diff without reading every card; a first-time user has no prior baseline to diff against. |
| Since-last-visit strip | Compact inline strip between header and KPI tiles (heading inline with the first line, up to 3 short lines total), hidden on first visit; "Sin cambios desde tu última visita, HH:MM" when nothing changed | An inline strip that never blocks the alert stack respects the <5s budget; a modal or overlay would cost an extra tap and hide the very screen the operator opened the app for. |
| Single-row header at kiosk size, wraps below it | Plant name · line · shift · "Última actualización HH:MM" all `whitespace-nowrap`; user name, avatar and Salir stay on the right. At kiosk size (E1) the whole header is one row; below it, it stacks into a short column instead of clipping or squeezing | Keeps the header's vertical budget small and predictable at 1280×800 (no scrolling there); below kiosk size the page scrolls anyway, so the header can wrap instead of forcing content off-screen. |
| "Última actualización HH:MM" | 24h HH:MM in the tablet's local time zone; server-provided (`tablero.ultimaActualizacion`, T9) instead of a client-side clock | Gives a trust signal for data freshness tied to the actual data, not the client's local timer. |
| Auto-refresh every 15s, no manual ACTUALIZAR button (D29) | The dashboard refetches `tablero` on a 15-second timer while logged in and the tab is visible (paused when hidden, via the Page Visibility API; refetches immediately on becoming visible again); it also still refetches after every action (attend/dismiss). No overlapping requests, no flicker (the last good tablero stays on screen during a refetch), no loading spinner | The floor tablet has no one to press a refresh button, and a shift can be triggered from Supabase at any time (E3) with nobody touching the tablet — the dashboard must catch up on its own within a bounded, short window. |
| "Atendida" / "No aplica", no confirmation | Two full-width buttons, both close the detail panel immediately; detail header shows the severity word (ALTA/MEDIA/BAJA) with the same icon/color as the stack; location + time at `text-4xl` (36px, ≥ 32px) | A confirmation dialog or a "thanks" message costs an extra tap and a second glance the operator doesn't have time for; showing a different word in the header than in the stack made the operator re-check they'd opened the right alert. |
| Avatar + PIN login kept | 4-digit PIN pad, no physical keyboard | Explicit trade-off: costs ~4 extra taps versus a single badge/tap login, but there is no keyboard on the floor tablet and this matches the existing product's login model. |
| No opacity, transitions or animation | All `opacity-*`, alpha colors, `transition-*`, `active:scale-*`, `animate-*` removed; `tw-animate-css` dropped | Motion and translucency read as noise under glare and cost attention the glance budget doesn't allow; state changes should be instant and certain. Enforced by `lib/design-rules.test.ts`. |
| No scroll only at kiosk size; nothing ever clips or overflows horizontally (D27) | At exactly 1280×800 (or larger in both dimensions, via the `kiosk:` variant) the dashboard, login, PIN pad and alert detail all fit the viewport with zero document scroll — that geometry is unchanged from before E1. Below kiosk size the page scrolls vertically like an ordinary page, but never horizontally, and nothing is ever silently clipped | A scrollbar or a silently clipped card hides alerts below the fold, which is unacceptable for a screen whose job is "show me what's wrong right now" — but that only holds at the fixed kiosk size the tablet actually runs at; forcing the same "zero scroll" rule onto a phone or a laptop browser would clip content instead, which is worse. Verified by `corepack pnpm test:ui` against a real Chrome at 4 viewports (see "Responsive layout and kiosk mode" below), not just unit tests. |

## Responsive layout and kiosk mode

D27 (E1): the app is mobile-first. Base styles target a small screen, and
the floor rules above (text ≥ 24px, touch targets ≥ 88px, color + shape +
word, no opacity/transitions/animations) apply at every size, not only at
the tablet's fixed geometry. The exact "no scroll" kiosk screen that shipped
before E1 is now gated behind a Tailwind v4 custom variant declared once in
`app/globals.css`:

```css
@custom-variant kiosk (@media (min-width: 1280px) and (min-height: 800px));
```

Any utility prefixed `kiosk:` (e.g. `kiosk:h-dvh kiosk:overflow-hidden`,
`kiosk:grid-cols-3`, `kiosk:truncate`) only applies when the viewport is at
least 1280×800 in both dimensions — the tablet's actual size. Below that:

- The page scrolls vertically like an ordinary web page; it never scrolls
  or clips horizontally.
- Login avatars: 1 column on phones, 2 from `md:`, 3 from `lg:` (independent
  of the kiosk variant, so a wide-but-short laptop screen still gets 3
  columns) — fluid-width cards instead of a fixed 280px.
- PIN pad: keys stay ≥ 88px and the pad fits a 390px-wide phone.
- Dashboard: the header wraps into a short column instead of squeezing onto
  one line; the since-last-visit strip wraps; KPI tiles stack into 1 column
  and become 3 columns from `md:`; alerts stack in a single column, and a
  secondary alert's title wraps onto a second line instead of truncating
  when the screen is too narrow to show it on one.
- The alert detail dialog scrolls if its content does not fit, and its two
  actions ("Atendida" / "No aplica") stack vertically instead of
  side-by-side.

`corepack pnpm test:ui` (`scripts/ui-check.mjs`, E2) checks all of this at
four viewports: kiosk (1280×800, the strict "no document scroll at all"
rules), a MacBook (1512×790 — wide but shorter than kiosk height, so it does
NOT get the kiosk geometry, proving the variant is gated on both
dimensions), a tablet in portrait (768×1024) and a phone (390×844). At every
non-kiosk size it asserts: no horizontal overflow, no clipped content, text
≥ 24px, touch targets ≥ 88px, and that every alert card and the "+N alertas
menos graves" overflow line can be scrolled into view and are then actually
visible. `lib/design-rules.test.ts` was checked to still pass with the
`kiosk:` variant in use (it forbids arbitrary `[Npx]` sizes, sub-24px text,
opacity, transitions and animations regardless of variant prefix).

## Simulate a shift (demo)

"Simular turno" is no longer a button in the app (D28, E3) — the app only
ever shows real data. A shift is triggered from Supabase itself instead,
either with no SQL at all or with one line of SQL:

**Without SQL, from the Supabase dashboard:**

1. Open your project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Go to **Table Editor** in the left sidebar.
3. Open the **demo_panel** table (one row per line).
4. Click the **simular_turno** cell of the line you want to simulate a
   shift on.
5. Choose **TRUE** and save.
6. Wait up to 15 seconds — the tablet's dashboard for that line
   auto-refreshes (D29) and shows the new alerts. The cell resets itself
   back to FALSE once the simulation has run, and `ultima_simulacion` /
   `alertas_generadas` record when it ran and how many alerts it made.

**With SQL, from the SQL editor** (same rules, same result, useful for
scripting or for `supabase/snippets/cron_demo.sql`):

```sql
select * from demo_simular_turno_linea('Línea 3 · Motores');
```

Both paths run the exact same rules the old in-app button always did: if
the line is saturated (every alert template already active), the oldest
open template alerts are closed as "No aplica" by the system first to make
room (K5); a generated alert linked to a KPI records that reading on the
line's indicator (D25); and every other indicator on the line then moves
one step toward OK (a "recovery reading", D26).

## How KPI tiles change

A KPI tile's state word (OK / ATENCIÓN / PARAR) is never stored on its own
(D24, Phase D): it is always derived from the indicator's latest `valor` and
two per-indicator thresholds. `indicadores.estado` is a Postgres GENERATED
column (`private.estado_indicador`, migration
`20260926000015_indicador_thresholds_and_readings.sql`); the mock adapter
mirrors the same derivation in `lib/domain/indicadores.ts#estadoIndicador`.
So the tile can only change when its `valor` changes, and every `valor`
change is one of the two events below — never a direct edit of the state.

| KPI (`clave`) | Direction | ATENCIÓN threshold | PARAR threshold |
| --- | --- | --- | --- |
| FPY (`fpy`) | higher is better | < 92 % | < 90 % |
| Defectos / hora (`dph`) | lower is better | > 4 | > 6 |
| Scrap (`scrap`) | lower is better | > 2 % | > 3 % |

A value exactly ON a threshold falls into the better band (e.g. FPY = 92.0
is OK, not ATENCIÓN; Defectos/hora = 6 is ATENCIÓN, not PARAR).

Two things move a `valor`, both server-side, both demo-only:

- **A generated alert with a linked KPI (D25/D31).** `plantillas_alerta` (the
  simulator's template catalog) can name an `indicador_clave`
  (`fpy`/`dph`/`scrap`), together with its own `lectura_min`/`lectura_max`
  (D31, Phase F) -- the range the KPI READING is drawn from, in the KPI's
  own unit, separate from `valor_min`/`valor_max` (the range for the
  alert's own displayed `valor`, in the alert's own unit -- e.g. "Torque
  fuera de rango" displays Nm but records a `dph` reading). When
  `demo_generar_alertas` picks such a template, it records a reading drawn
  from `lectura_min`/`lectura_max` on the line's matching indicator (`valor`
  + `actualizado_en`); the tile's state then follows from that new `valor`
  automatically. 10 of the 11 seed templates are KPI-linked; only "Nivel de
  refrigerante en rango" (severidad `ok`) stays unlinked.
- **A recovery reading (D26/D30).** `demo_simular_turno` / `demo_simular_turno_linea`
  (shift simulation, triggered from Supabase -- see "Simulate a shift" below)
  and `demo_autoresolver` (the stale-alert auto-resolve job) both call
  `private.recuperar_indicadores` afterwards for the affected line,
  excluding any KPI a new alert just hit. For every OTHER indicator on that
  line:
  - **D30 (Phase F): if an OPEN alert (`estado = 'nueva'`) linked to that KPI
    still exists on the line**, the indicator does NOT recover -- it is
    re-read instead, from the MOST SEVERE such alert's template
    `lectura_min`/`lectura_max` range (PARAR over ATENCIÓN; a tie goes to
    the newest alert). This is what keeps a KPI tile PARAR/ATENCIÓN for as
    long as an open alert tied to it is still unresolved, instead of
    silently greening out from under it.
  - Otherwise, it moves ONE state toward OK, with a `valor` inside the new
    band (PARAR → a value inside the ATENCIÓN band; ATENCIÓN → a value
    inside the OK band; OK → a small, direction-safe nudge that stays OK).

**Resolving an alert (Atendida / No aplica) never changes any KPI at that
moment.** `resolver_alerta` only ever touches the `alertas` row it resolves;
a pgTAP test (`supabase/tests/09_indicadores_lecturas.test.sql`) asserts
every indicator's `valor`/`estado`/`actualizado_en` is byte-for-byte
unchanged across both resolutions, and the mock adapter has the same
assertion in `lib/domain/in-memory-floor-repository.test.ts`. Once an
alert that was holding a KPI (D30, above) is resolved, that KPI simply
stops being held -- it recovers normally starting from the next shift.

The mock adapter mirrors the recovery rule (every simulated shift recovers
every KPI, since none of `ALERTAS_NUEVO_TURNO`'s two fixed alerts link to a
`clave` today) but does not yet reproduce the KPI-linked-reading side of
D25/D31: its shift alerts carry no `valor`/`indicador_clave` data to record,
so the D30 "held by an open alert" rule has nothing to hold there either.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
