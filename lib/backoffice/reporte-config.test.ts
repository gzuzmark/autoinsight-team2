import { afterEach, describe, expect, it } from "vitest"
import { appBaseUrl, reportRecipients } from "@/lib/backoffice/reporte-config"

const ORIGINAL_ENV = { ...process.env }

describe("appBaseUrl", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("defaults to the deployed Vercel URL when APP_BASE_URL is unset", () => {
    delete process.env.APP_BASE_URL
    expect(appBaseUrl()).toBe("https://autoinsight-team2-nine.vercel.app")
  })

  it("uses APP_BASE_URL when set", () => {
    process.env.APP_BASE_URL = "https://example.com"
    expect(appBaseUrl()).toBe("https://example.com")
  })
})

describe("reportRecipients", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("defaults to the Mailinator demo inbox when REPORT_RECIPIENTS is unset", () => {
    delete process.env.REPORT_RECIPIENTS
    expect(reportRecipients()).toEqual(["demo-autoinsight@mailinator.com"])
  })

  it("splits a comma-separated REPORT_RECIPIENTS and trims whitespace", () => {
    process.env.REPORT_RECIPIENTS = " a@example.com, b@example.com ,c@example.com"
    expect(reportRecipients()).toEqual(["a@example.com", "b@example.com", "c@example.com"])
  })

  it("ignores empty entries", () => {
    process.env.REPORT_RECIPIENTS = "a@example.com,,  ,b@example.com"
    expect(reportRecipients()).toEqual(["a@example.com", "b@example.com"])
  })
})
