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
corepack pnpm test:run
corepack pnpm exec tsc --noEmit
```

`next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `corepack pnpm build`
does **not** type-check the project — `tsc --noEmit` is the real type gate and
must be run separately.

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
| State palette | OK bg `#e7f8ec` / text `#0a3d1f` (11.20:1, luminance 0.90) · ATENCIÓN bg `#ffb703` / text `#0a0800` (11.48:1, luminance 0.55) · PARAR bg `#3d0106` / text `#ffffff` (17.42:1, luminance 0.01) | All three pass WCAG AAA (≥ 7:1) and their relative luminance is clearly separated (high/mid/low), so the states stay distinguishable even in grayscale or with reflections. |
| State word size | ≥ 48px | Legible at arm's length in a single glance. |
| Body text size | ≥ 24px everywhere | Nothing readable falls below comfortable glance-reading size. |
| Touch targets | ≥ 88×88px (Salir, Volver, demo button, alert cards, PIN keys, login avatars) | Reliable with work gloves; small targets cause mis-taps under time pressure. |
| KPI tiles show no numbers | KPI name + state word + shape symbol only, no raw value | A bare number ("88.4%") needs interpretation time the floor doesn't have; the state word answers "is this OK?" directly. |
| Top alert is tallest, largest font | First card in the stack gets more height and a bigger font than the rest | Directs the first glance to the single most urgent item instead of spreading attention evenly. |
| Alert stack capped at 3 + overflow line | "+N alertas menos graves" (singular "+1 alerta menos grave") | Keeps the highest-severity items on screen without a scrolling list; the overflow line still discloses that lower-severity alerts exist. |
| Unseen-alert dot | Solid dot + sr-only "Nueva" on alerts not seen at this user's last logout; no dot on first visit | Gives a returning operator a fast visual diff without reading every card; a first-time user has no prior baseline to diff against. |
| Since-last-visit strip | Inline strip between header and KPI tiles ("Desde tu última visita", up to 3 short lines), hidden on first visit; "Sin cambios desde tu última visita, HH:MM" when nothing changed | An inline strip that never blocks the alert stack respects the <5s budget; a modal or overlay would cost an extra tap and hide the very screen the operator opened the app for. |
| "Última actualización HH:MM" | 24h, es-AR style, timezone-pinned, set on login and on shift simulation | Gives a trust signal for data freshness without a fake refresh action. |
| No manual ACTUALIZAR button | Deferred to T9 (client data layer / API wiring) | With mock, static data, a refresh button that does nothing erodes trust faster than no button at all; it returns once there is real server data to fetch. |
| "Atendida" / "No aplica", no confirmation | Two full-width buttons, both close the detail panel immediately | A confirmation dialog or a "thanks" message costs an extra tap and a second glance the operator doesn't have time for. |
| Avatar + PIN login kept | 4-digit PIN pad, no physical keyboard | Explicit trade-off: costs ~4 extra taps versus a single badge/tap login, but there is no keyboard on the floor tablet and this matches the existing product's login model. |
| No opacity, transitions or animation | All `opacity-*`, alpha colors, `transition-*`, `active:scale-*`, `animate-*` removed; `tw-animate-css` dropped | Motion and translucency read as noise under glare and cost attention the glance budget doesn't allow; state changes should be instant and certain. |
| No scroll at 1280×800 | Design target for the dashboard, login, PIN pad and alert detail (browser re-check pending after the U7 size increases, see `odd/tasks/autoinsight-port.md` U11) | A scrollbar hides alerts below the fold, which is unacceptable for a screen whose job is "show me what's wrong right now". |

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
