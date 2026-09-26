// Floor-tablet UI check (D4-D13): renders the app in a real Chrome at
// 1280x800 and asserts the hard rules that unit tests cannot see (rendered
// layout, clipping, computed font size, touch target geometry, console
// errors). Run with a Next dev server already listening on BASE_URL
// (default http://localhost:3100).
//
// Usage: corepack pnpm test:ui   (see package.json "test:ui")
//        BASE_URL=http://127.0.0.1:3100 node scripts/ui-check.mjs

import { chromium } from "playwright-core"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100"
const VIEWPORT = { width: 1280, height: 800 }
const MIN_TEXT_PX = 24
const MIN_TARGET_PX = 88

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
  try {
    await runScenarios(browser)
  } finally {
    await browser.close()
  }
}

async function runScenarios(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT })

  const consoleErrors = []
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text())
  })
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message))

  const allViolations = []

  async function check(name) {
    const result = await page.evaluate(
      ({ MIN_TEXT_PX, MIN_TARGET_PX }) => {
        const violations = []
        const docEl = document.documentElement
        if (docEl.scrollHeight > docEl.clientHeight + 1) {
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
      { MIN_TEXT_PX, MIN_TARGET_PX },
    )

    if (result.length > 0) {
      allViolations.push(`\n== ${name} ==`)
      allViolations.push(...result.map((v) => `  - ${v}`))
    }
    console.log(`${name}: ${result.length === 0 ? "OK" : `${result.length} violation(s)`}`)
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

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" })
  await irAvatares()
  await check("login")

  await page.getByRole("button", { name: /Ana Ríos/ }).click()
  await irPin()
  await check("pin")

  for (const d of "1234") await page.getByRole("button", { name: d, exact: true }).click()
  await irTablero()
  await check("dashboard (first visit)")

  await page.locator("main button").filter({ hasText: "FPY por debajo del 90" }).first().click()
  await page.getByRole("dialog").waitFor({ state: "visible" })
  await check("detail")

  await page.keyboard.press("Escape")
  await page.getByRole("dialog").waitFor({ state: "hidden" })
  await page.getByRole("button", { name: "Salir" }).click()
  await irAvatares()
  await ingresarComoAna()
  await check("dashboard (second visit, strip)")

  // F5 addition: resolve an alert (Atendida) and check the stack/strip right
  // after — cheap regression coverage for F1 (strip stays in sync) and F3
  // (focus lands somewhere sane, dialog closes) on a real page.
  await page.locator("main button[data-alert-id]").first().click()
  await page.getByRole("dialog").waitFor({ state: "visible" })
  await page.getByRole("button", { name: "Atendida" }).click()
  await page.getByRole("dialog").waitFor({ state: "hidden" })
  await check("dashboard (after resolving an alert)")

  await page.goto(`${BASE_URL}/?demo=1`, { waitUntil: "networkidle" })
  await irAvatares()
  await ingresarComoAna()
  const alertCountBeforeSimular = await totalAlertCount()
  await page.getByRole("button", { name: /Simular turno/ }).click()
  // K3: data-agnostic -- wait for the total active-alert count to change,
  // instead of a specific mock-only alert title, so this passes whether the
  // shift simulation ran against the in-memory mock (fixed
  // ALERTAS_NUEVO_TURNO) or a local Supabase stack (demo_simular_turno's
  // weighted random pick from supabase/seed.sql's template catalog).
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
    alertCountBeforeSimular,
    { polling: 100 },
  )
  await check("dashboard (after shift simulation)")

  if (consoleErrors.length > 0) {
    allViolations.push("\n== console errors ==")
    allViolations.push(...consoleErrors.map((e) => `  - ${e}`))
  }

  if (allViolations.length > 0) {
    console.error("\ntest:ui FAILED\n" + allViolations.join("\n"))
    process.exit(1)
  }

  console.log("\ntest:ui PASSED: no scroll, no text<24px, no target<88px, no clipped content, no console errors.")
}

main().catch((err) => {
  console.error("test:ui crashed:", err)
  process.exit(1)
})
