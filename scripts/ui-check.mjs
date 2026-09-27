// Floor-tablet UI check (D4-D13, D27/E1-E2): renders the app in a real Chrome
// at several viewport sizes and asserts the hard rules that unit tests cannot
// see (rendered layout, clipping, computed font size, touch target geometry,
// console errors). Run with a Next dev server already listening on BASE_URL
// (default http://localhost:3100).
//
// Usage: corepack pnpm test:ui   (see package.json "test:ui")
//        BASE_URL=http://127.0.0.1:3100 node scripts/ui-check.mjs
//
// Sizes (E2): the kiosk geometry (D27) -- today's exact no-scroll screen --
// only applies at 1280x800 (kiosk custom variant, min-width 1280 AND
// min-height 800). Every other viewport is an ordinary scrolling page: no
// horizontal overflow, no clipped content, text >= 24px, touch targets >=
// 88px, and every alert card / overflow line reachable by scrolling.

import { chromium } from "playwright-core"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100"
const MIN_TEXT_PX = 24
const MIN_TARGET_PX = 88

const VIEWPORTS = [
  { name: "kiosk 1280x800", width: 1280, height: 800, allowScroll: false },
  { name: "MacBook 1512x790", width: 1512, height: 790, allowScroll: true },
  { name: "tablet portrait 768x1024", width: 768, height: 1024, allowScroll: true },
  { name: "phone 390x844", width: 390, height: 844, allowScroll: true },
]

// E4: the container running the local Supabase Postgres image, so this
// script can trigger a shift from OUTSIDE the app (direct DB call) and prove
// the dashboard auto-refreshes without any click. Unset (the default) skips
// that one scenario with a clear notice instead of failing -- it needs a
// local stack most environments running this script will not have up.
const UI_CHECK_DB_CONTAINER = process.env.UI_CHECK_DB_CONTAINER

async function main() {
  let res
  try {
    res = await fetch(BASE_URL, { method: "GET" })
  } catch (err) {
    console.error(`test:ui: cannot reach ${BASE_URL} (${err.message}).`)
    console.error(`Start the dev server first: corepack pnpm dev --port 3100`)
    process.exit(1)
  }
  if (!res.ok) {
    console.error(`test:ui: ${BASE_URL} responded with HTTP ${res.status}.`)
    process.exit(1)
  }

  // F5: the browser is always closed, even if a scenario throws (a stray
  // Chrome process left running is worse than a failed check).
  const browser = await chromium.launch({ channel: "chrome" })
  const allViolations = []
  try {
    for (const viewport of VIEWPORTS) {
      await runScenariosAtViewport(browser, viewport, allViolations)
      await runOfficeScenariosAtViewport(browser, viewport, allViolations)
    }
    await runOfficeNavigationScenario(browser, allViolations)
    await runOfficeDarkModeScenario(browser, allViolations)
    await runAutoRefreshScenario(browser, allViolations)
  } finally {
    await browser.close()
  }

  if (allViolations.length > 0) {
    console.error("\ntest:ui FAILED\n" + allViolations.join("\n"))
    process.exit(1)
  }

  console.log(
    "\ntest:ui PASSED: every viewport clean (kiosk: no scroll; others: no horizontal overflow), " +
      "no text<24px, no target<88px, no clipped content, every alert reachable, no console errors.",
  )
}

async function runScenariosAtViewport(browser, viewport, allViolations) {
  const { name, width, height, allowScroll } = viewport
  console.log(`\n--- ${name} ---`)
  const page = await browser.newPage({ viewport: { width, height } })

  const consoleErrors = []
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text())
  })
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message))

  async function check(label) {
    const result = await page.evaluate(
      ({ MIN_TEXT_PX, MIN_TARGET_PX, allowScroll }) => {
        const violations = []
        const docEl = document.documentElement
        if (docEl.scrollWidth > docEl.clientWidth + 1) {
          violations.push(`horizontal overflow: scrollWidth=${docEl.scrollWidth} clientWidth=${docEl.clientWidth}`)
        }
        if (!allowScroll && docEl.scrollHeight > docEl.clientHeight + 1) {
          violations.push(`document scroll: scrollHeight=${docEl.scrollHeight} clientHeight=${docEl.clientHeight}`)
        }

        const main = document.querySelector("main")
        if (!main) {
          violations.push("no <main> element found")
          return violations
        }

        // Text below the minimum readable size (skips sr-only text: it is
        // never rendered on screen, so it is not part of the glance-reading
        // budget this rule protects).
        for (const el of main.querySelectorAll("*")) {
          const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
          if (!hasOwnText) continue
          const r = el.getBoundingClientRect()
          if (r.width <= 1 || r.height <= 1) continue
          const fs = parseFloat(getComputedStyle(el).fontSize)
          if (fs < MIN_TEXT_PX) {
            violations.push(`text<${MIN_TEXT_PX}px: ${fs}px "${el.textContent.trim().slice(0, 40)}"`)
          }
        }

        // Interactive targets below the minimum touch size.
        for (const el of main.querySelectorAll("button, a, [role=button]")) {
          const r = el.getBoundingClientRect()
          if (r.width < MIN_TARGET_PX || r.height < MIN_TARGET_PX) {
            const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)
            violations.push(`target<${MIN_TARGET_PX}px: ${Math.round(r.width)}x${Math.round(r.height)} "${label}"`)
          }
        }

        // Clipped content: an element whose own CSS actually hides overflow
        // (overflow: hidden/clip) yet its content is taller/wider than the
        // box. A few px of slack absorbs font line-height/sub-pixel rounding
        // that is not real clipping; intentional single-line truncation
        // (text-overflow: ellipsis, i.e. Tailwind's `truncate`) is excluded
        // since that is graceful degradation, not a layout bug.
        const CLIP_SLACK = 6
        for (const el of main.querySelectorAll("*")) {
          const cs = getComputedStyle(el)
          const hidesOverflowY = cs.overflowY === "hidden" || cs.overflowY === "clip"
          const hidesOverflowX = cs.overflowX === "hidden" || cs.overflowX === "clip"
          if (!hidesOverflowY && !hidesOverflowX) continue
          if (cs.textOverflow === "ellipsis") continue
          // sr-only elements are intentionally boxed to ~0px (accessible
          // name only, never rendered) — not a layout clipping bug.
          const rr = el.getBoundingClientRect()
          if (rr.width <= 1 && rr.height <= 1) continue
          const label = (el.textContent || "").trim().slice(0, 40)
          if (hidesOverflowY && el.scrollHeight > el.clientHeight + CLIP_SLACK) {
            violations.push(
              `clipped (overflow-y hidden): scrollHeight=${el.scrollHeight} clientHeight=${el.clientHeight} <${el.tagName.toLowerCase()}> "${label}"`,
            )
          }
          if (hidesOverflowX && el.scrollWidth > el.clientWidth + CLIP_SLACK) {
            violations.push(
              `clipped (overflow-x hidden): scrollWidth=${el.scrollWidth} clientWidth=${el.clientWidth} <${el.tagName.toLowerCase()}> "${label}"`,
            )
          }
        }

        // Text spilling outside its own interactive button box (ignoring
        // intentionally truncated text and small sub-pixel slack).
        const BOX_SLACK = 4
        for (const btn of main.querySelectorAll("button, a, [role=button]")) {
          const br = btn.getBoundingClientRect()
          for (const el of btn.querySelectorAll("*")) {
            const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
            if (!hasOwnText) continue
            if (getComputedStyle(el).textOverflow === "ellipsis") continue
            const r = el.getBoundingClientRect()
            if (
              r.right > br.right + BOX_SLACK ||
              r.bottom > br.bottom + BOX_SLACK ||
              r.left < br.left - BOX_SLACK ||
              r.top < br.top - BOX_SLACK
            ) {
              violations.push(
                `text outside button box: "${el.textContent.trim().slice(0, 30)}" el=${Math.round(r.right)},${Math.round(r.bottom)} button=${Math.round(br.right)},${Math.round(br.bottom)}`,
              )
            }
          }
        }

        return violations
      },
      { MIN_TEXT_PX, MIN_TARGET_PX, allowScroll },
    )

    if (result.length > 0) {
      allViolations.push(`\n== ${name} / ${label} ==`)
      allViolations.push(...result.map((v) => `  - ${v}`))
    }
    console.log(`${label}: ${result.length === 0 ? "OK" : `${result.length} violation(s)`}`)
  }

  // E2: every visible alert card and the "+N alertas menos graves" overflow
  // line must be reachable -- scroll it into view, then confirm its box
  // actually intersects the viewport. On a scrolling (non-kiosk) page this is
  // the whole point of the rule; on kiosk everything is already on-screen by
  // construction, so this is a cheap extra check there too.
  async function checkAlertsReachable(label) {
    const problems = await page.evaluate(() => {
      const main = document.querySelector("main")
      if (!main) return ["no <main> element found"]
      const targets = [...main.querySelectorAll("[data-alert-id]")]
      for (const el of main.querySelectorAll("div")) {
        const text = (el.textContent || "").trim()
        if (/^\+\d+ (?:alerta menos grave|alertas menos graves)$/.test(text)) {
          targets.push(el)
          break
        }
      }
      const out = []
      for (const el of targets) {
        el.scrollIntoView({ block: "center", inline: "center" })
        const r = el.getBoundingClientRect()
        const visible = r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
        if (!visible) {
          out.push(`not reachable after scrollIntoView: "${(el.textContent || "").trim().slice(0, 40)}"`)
        }
      }
      return out
    })
    if (problems.length > 0) {
      allViolations.push(`\n== ${name} / ${label} (reachability) ==`)
      allViolations.push(...problems.map((v) => `  - ${v}`))
    }
    console.log(`${label} (reachability): ${problems.length === 0 ? "OK" : `${problems.length} violation(s)`}`)
  }

  // F5: wait on the observable screen that is actually about to be checked,
  // instead of a fixed sleep — every wait below is tied to something the
  // rendered DOM shows once the previous interaction has taken effect.

  async function irAvatares() {
    await page.getByRole("button", { name: /Ana Ríos/ }).waitFor({ state: "visible" })
  }

  async function irPin() {
    await page.getByText("Ingresa tu PIN").waitFor({ state: "visible" })
  }

  async function irTablero() {
    await page.getByRole("button", { name: "Salir" }).waitFor({ state: "visible" })
  }

  async function ingresarComoAna() {
    await page.getByRole("button", { name: /Ana Ríos/ }).click()
    await irPin()
    for (const d of "1234") await page.getByRole("button", { name: d, exact: true }).click()
    await irTablero()
  }

  // K3: total count of active alerts shown on the dashboard -- the visible
  // cards (top 3, one per data-alert-id) plus whatever the "+N alertas menos
  // graves" overflow line reports, if present. Reading this count (instead
  // of a specific alert's title, which only exists in mock mode's fixed
  // ALERTAS_NUEVO_TURNO) is what lets the shift-simulation scenario below
  // pass against BOTH mock data and a real, randomly-seeded local Supabase
  // stack (DATA_SOURCE=supabase): whichever alert(s) demo_simular_turno
  // actually generates, the total count still goes up.
  function totalAlertCountInBrowser() {
    const main = document.querySelector("main")
    if (!main) return 0
    const cards = main.querySelectorAll("[data-alert-id]").length
    let overflow = 0
    for (const el of main.querySelectorAll("div")) {
      const text = (el.textContent || "").trim()
      const m = text.match(/^\+(\d+) (?:alerta menos grave|alertas menos graves)$/)
      if (m) {
        overflow = parseInt(m[1], 10)
        break
      }
    }
    return cards + overflow
  }

  async function totalAlertCount() {
    return page.evaluate(totalAlertCountInBrowser)
  }

  try {
    await page.goto(`${BASE_URL}/planta`, { waitUntil: "networkidle" })
    await irAvatares()
    await check("login")

    await page.getByRole("button", { name: /Ana Ríos/ }).click()
    await irPin()
    await check("pin")

    for (const d of "1234") await page.getByRole("button", { name: d, exact: true }).click()
    await irTablero()
    await check("dashboard (first visit)")
    await checkAlertsReachable("dashboard (first visit)")

    // E2: the mock repository is a single process-wide singleton, shared
    // across every viewport this script loops through, and each iteration
    // below resolves one alert -- so by the last viewport(s) the seed pool
    // may already be empty ("Sin alertas abiertas"). That is a legitimate
    // screen this check must still pass (D8 empty state), not a script bug:
    // skip only the alert-specific interactions with a clear notice instead
    // of failing on a Playwright timeout waiting for a card that will never
    // appear.
    const hayAlertas = (await page.locator("main [data-alert-id]").count()) > 0

    if (hayAlertas) {
      // Open whichever alert is on top: the check must not depend on seed
      // data still being active (earlier runs resolve alerts on shared
      // databases).
      await page.locator("main [data-alert-id]").first().click()
      await page.getByRole("dialog").waitFor({ state: "visible" })
      await check("detail")

      await page.keyboard.press("Escape")
      await page.getByRole("dialog").waitFor({ state: "hidden" })
    } else {
      console.log("detail: SKIPPED (no active alerts left in the shared mock pool)")
    }

    await page.getByRole("button", { name: "Salir" }).click()
    await irAvatares()
    await ingresarComoAna()
    await check("dashboard (second visit, strip)")

    // F5 addition: resolve an alert (Atendida) and check the stack/strip right
    // after — cheap regression coverage for F1 (strip stays in sync) and F3
    // (focus lands somewhere sane, dialog closes) on a real page.
    if (await page.locator("main button[data-alert-id]").count()) {
      await page.locator("main button[data-alert-id]").first().click()
      await page.getByRole("dialog").waitFor({ state: "visible" })
      await page.getByRole("button", { name: "Atendida" }).click()
      await page.getByRole("dialog").waitFor({ state: "hidden" })
    } else {
      console.log("dashboard (after resolving an alert): SKIPPED (no active alerts left in the shared mock pool)")
    }
    await check("dashboard (after resolving an alert)")
    await checkAlertsReachable("dashboard (after resolving an alert)")

    if (consoleErrors.length > 0) {
      allViolations.push(`\n== ${name} / console errors ==`)
      allViolations.push(...consoleErrors.map((e) => `  - ${e}`))
    }
  } finally {
    await page.close()
  }
}

// Office smoke (O5): the office desk view (/, /oficina, /oficina/alertas/[id],
// /oficina/reportes) is static and not held to the floor's 24px text / 88px
// touch target rules (O-D3) -- this only asserts no horizontal overflow and
// no console errors on those pages, plus the three cross-app navigation
// links. `/` is the one exception: it is the tablet's entry point, so it
// still follows the floor rules (O-D1), checked the same way the floor
// scenario checks `/planta`.
const SAMPLE_ALERT_ID = "torque-fuera-de-rango-l3-e7"

function officePageChecks(page, name, allViolations) {
  async function checkOverflow(label) {
    const result = await page.evaluate(() => {
      const docEl = document.documentElement
      const violations = []
      if (docEl.scrollWidth > docEl.clientWidth + 1) {
        violations.push(`horizontal overflow: scrollWidth=${docEl.scrollWidth} clientWidth=${docEl.clientWidth}`)
      }
      return violations
    })
    if (result.length > 0) {
      allViolations.push(`\n== office ${name} / ${label} ==`)
      allViolations.push(...result.map((v) => `  - ${v}`))
    }
    console.log(`office ${label}: ${result.length === 0 ? "OK" : `${result.length} violation(s)`}`)
  }

  // O-D1: `/` is the tablet's entry point, so (unlike the rest of /oficina)
  // it still follows the floor's 24px text / 88px touch target rules.
  async function checkSelectorFloorRules(label) {
    const result = await page.evaluate(
      ({ MIN_TEXT_PX, MIN_TARGET_PX }) => {
        const violations = []
        const main = document.querySelector("main")
        if (!main) {
          violations.push("no <main> element found")
          return violations
        }
        for (const el of main.querySelectorAll("*")) {
          const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
          if (!hasOwnText) continue
          const r = el.getBoundingClientRect()
          if (r.width <= 1 || r.height <= 1) continue
          const fs = parseFloat(getComputedStyle(el).fontSize)
          if (fs < MIN_TEXT_PX) {
            violations.push(`text<${MIN_TEXT_PX}px: ${fs}px "${el.textContent.trim().slice(0, 40)}"`)
          }
        }
        for (const el of main.querySelectorAll("button, a, [role=button]")) {
          const r = el.getBoundingClientRect()
          if (r.width < MIN_TARGET_PX || r.height < MIN_TARGET_PX) {
            const targetLabel = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)
            violations.push(`target<${MIN_TARGET_PX}px: ${Math.round(r.width)}x${Math.round(r.height)} "${targetLabel}"`)
          }
        }
        return violations
      },
      { MIN_TEXT_PX, MIN_TARGET_PX },
    )
    if (result.length > 0) {
      allViolations.push(`\n== office ${name} / ${label} (floor rules) ==`)
      allViolations.push(...result.map((v) => `  - ${v}`))
    }
    console.log(`office ${label} (floor rules): ${result.length === 0 ? "OK" : `${result.length} violation(s)`}`)
  }

  return { checkOverflow, checkSelectorFloorRules }
}

// Visits the four static office/selector routes at each viewport (no login
// involved -- none of these routes need one) and asserts no horizontal
// overflow or console errors; `/` additionally keeps the floor's 24px/88px
// rules (O-D1). Kept separate from the one-time navigation scenario below so
// this loop never touches the shared login-throttle bucket (D21): with 4
// viewports x the existing floor scenario's 2 logins each, adding logins
// here too would push a full run over the throttle window.
async function runOfficeScenariosAtViewport(browser, viewport, allViolations) {
  const { name, width, height } = viewport
  console.log(`\n--- office / ${name} ---`)
  const page = await browser.newPage({ viewport: { width, height } })

  const consoleErrors = []
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text())
  })
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message))

  const { checkOverflow, checkSelectorFloorRules } = officePageChecks(page, name, allViolations)

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: "¿Cómo vas a trabajar hoy?" }).waitFor({ state: "visible" })
    await checkOverflow("selector")
    await checkSelectorFloorRules("selector")

    await page.goto(`${BASE_URL}/oficina`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: "Resumen de planta" }).waitFor({ state: "visible" })
    await checkOverflow("oficina resumen")

    await page.goto(`${BASE_URL}/oficina/alertas/${SAMPLE_ALERT_ID}`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: "Investigación de alerta" }).waitFor({ state: "visible" })
    await checkOverflow("oficina alerta")

    await page.goto(`${BASE_URL}/oficina/reportes`, { waitUntil: "networkidle" })
    await page.getByText("Programar reporte", { exact: true }).waitFor({ state: "visible" })
    await checkOverflow("oficina reportes")

    if (consoleErrors.length > 0) {
      allViolations.push(`\n== office ${name} / console errors ==`)
      allViolations.push(...consoleErrors.map((e) => `  - ${e}`))
    }
  } finally {
    await page.close()
  }
}

// O6 regression guard: the office desk view is light-only, but a leftover
// `@media (prefers-color-scheme: dark)` rule used to swap every shadcn
// token to the dark palette whenever the OS was in Dark appearance, making
// office cards render dark on the light shell and the header title render
// white-on-white. Checked once (not per viewport -- it needs no login and
// one viewport is enough to catch a regression) by emulating a dark OS
// color scheme and asserting the rendered card background and header title
// color stay light-theme.
async function runOfficeDarkModeScenario(browser, allViolations) {
  console.log("\n--- office dark-mode regression guard (prefers-color-scheme: dark) ---")
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" })
  try {
    await page.goto(`${BASE_URL}/oficina`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: "Resumen de planta" }).waitFor({ state: "visible" })

    const result = await page.evaluate(() => {
      const violations = []

      // getComputedStyle can serialize a color in a non-sRGB CSS Color 4
      // notation (e.g. `lab(100 0 0)` for a color defined via oklch()), so a
      // naive regex over the numbers would misread it as raw RGB. Round-trip
      // through a 1x1 canvas instead: canvas fillStyle always normalizes to
      // sRGB regardless of the input color space.
      function luminance(cssColor) {
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = 1
        const ctx = canvas.getContext("2d")
        if (!ctx) return null
        ctx.fillStyle = cssColor
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }

      // Any card-like container (rounded box with a border, as shadcn Card
      // renders) should keep a light (near-white) background.
      const card = document.querySelector("main [class*='rounded']")
      if (!card) {
        violations.push("no card-like element found under <main>")
      } else {
        const bg = getComputedStyle(card).backgroundColor
        const l = luminance(bg)
        if (l === null || l < 200) {
          violations.push(`card background is not light-theme: ${bg} (luminance ${l})`)
        }
      }

      const heading = document.querySelector("h1")
      if (!heading) {
        violations.push("no <h1> header title found")
      } else {
        const color = getComputedStyle(heading).color
        const l = luminance(color)
        if (l === null || l > 100) {
          violations.push(`header title is not dark/high-contrast text: ${color} (luminance ${l})`)
        }
      }

      return violations
    })

    if (result.length > 0) {
      allViolations.push(`\n== office dark-mode regression guard ==`)
      allViolations.push(...result.map((v) => `  - ${v}`))
    }
    console.log(`office dark-mode: ${result.length === 0 ? "OK" : `${result.length} violation(s)`}`)
  } catch (err) {
    allViolations.push(`\n== office dark-mode regression guard ==`)
    allViolations.push(`  - ${err.message}`)
    console.log("office dark-mode: FAILED")
  } finally {
    await page.close()
  }
}

// Cross-app navigation, checked once (not per viewport, at kiosk size):
// selector -> oficina (link), oficina -> planta (header switch), and
// planta -> selector (the "Cambiar vista" header link, which only appears
// once logged in). Kept to a single login/logout pair -- see the throttle
// note above.
async function runOfficeNavigationScenario(browser, allViolations) {
  console.log("\n--- office navigation (selector <-> oficina <-> planta) ---")
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: "¿Cómo vas a trabajar hoy?" }).waitFor({ state: "visible" })

    await page.getByRole("link", { name: "Entrar a Oficina" }).click()
    await page.getByRole("heading", { name: "Resumen de planta" }).waitFor({ state: "visible" })
    console.log("navigation selector -> oficina: OK")

    await page.getByRole("link", { name: "Planta", exact: true }).click()
    await page.getByRole("button", { name: /Ana Ríos/ }).waitFor({ state: "visible" })
    console.log("navigation oficina switch -> planta: OK")

    await page.getByRole("button", { name: /Ana Ríos/ }).click()
    await page.getByText("Ingresa tu PIN").waitFor({ state: "visible" })
    for (const d of "1234") await page.getByRole("button", { name: d, exact: true }).click()
    await page.getByRole("button", { name: "Salir" }).waitFor({ state: "visible" })
    await page.getByRole("link", { name: "Cambiar vista" }).click()
    await page.getByRole("heading", { name: "¿Cómo vas a trabajar hoy?" }).waitFor({ state: "visible" })
    console.log("navigation planta -> selector: OK")
  } catch (err) {
    allViolations.push(`\n== office navigation ==`)
    allViolations.push(`  - ${err.message}`)
    console.log("office navigation: FAILED")
  } finally {
    await page.close()
  }
}

// E4: trigger a shift from OUTSIDE the app (a direct DB call, never a click)
// and confirm the dashboard picks it up within the 15s auto-refresh window.
// Skipped with a clear notice when UI_CHECK_DB_CONTAINER is unset, or when
// the app is not running against Supabase (mock mode has no such external
// trigger) — this is the one scenario that is not viewport-specific, so it
// runs once at kiosk size.
async function runAutoRefreshScenario(browser, allViolations) {
  console.log("\n--- auto-refresh (external shift trigger) ---")
  if (!UI_CHECK_DB_CONTAINER) {
    console.log("auto-refresh: SKIPPED (UI_CHECK_DB_CONTAINER not set; needs a local Supabase stack)")
    return
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  try {
    await page.goto(`${BASE_URL}/planta`, { waitUntil: "networkidle" })
    await page.getByRole("button", { name: /Ana Ríos/ }).click()
    await page.getByText("Ingresa tu PIN").waitFor({ state: "visible" })
    for (const d of "1234") await page.getByRole("button", { name: d, exact: true }).click()
    await page.getByRole("button", { name: "Salir" }).waitFor({ state: "visible" })

    const before = await page.evaluate(() => {
      const main = document.querySelector("main")
      if (!main) return 0
      const cards = main.querySelectorAll("[data-alert-id]").length
      let overflow = 0
      for (const el of main.querySelectorAll("div")) {
        const text = (el.textContent || "").trim()
        const m = text.match(/^\+(\d+) (?:alerta menos grave|alertas menos graves)$/)
        if (m) {
          overflow = parseInt(m[1], 10)
          break
        }
      }
      return cards + overflow
    })

    const { execFile } = await import("node:child_process")
    const { promisify } = await import("node:util")
    const execFileAsync = promisify(execFile)
    await execFileAsync("docker", [
      "exec",
      UI_CHECK_DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-c",
      "update public.demo_panel set simular_turno = true where linea = 'Línea 3 · Motores'",
    ])

    await page.waitForFunction(
      (before) => {
        const main = document.querySelector("main")
        if (!main) return false
        const cards = main.querySelectorAll("[data-alert-id]").length
        let overflow = 0
        for (const el of main.querySelectorAll("div")) {
          const text = (el.textContent || "").trim()
          const m = text.match(/^\+(\d+) (?:alerta menos grave|alertas menos graves)$/)
          if (m) {
            overflow = parseInt(m[1], 10)
            break
          }
        }
        return cards + overflow !== before
      },
      before,
      { timeout: 20_000, polling: 500 },
    )
    console.log("auto-refresh: OK (alert count changed within 20s with no click)")
  } catch (err) {
    allViolations.push(`\n== auto-refresh (external shift trigger) ==`)
    allViolations.push(`  - ${err.message}`)
    console.log("auto-refresh: FAILED")
  } finally {
    await page.close()
  }
}

main().catch((err) => {
  console.error("test:ui crashed:", err)
  process.exit(1)
})
