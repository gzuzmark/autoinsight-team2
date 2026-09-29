import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getEmailSender, resetEmailSenderForTests } from "@/lib/email/get-email-sender"
import { LogEmailSender } from "@/lib/email/log-sender"
import { GmailSmtpSender } from "@/lib/email/gmail-sender"

const ORIGINAL_ENV = { ...process.env }

describe("getEmailSender", () => {
  beforeEach(() => {
    resetEmailSenderForTests()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    resetEmailSenderForTests()
  })

  it("falls back to LogEmailSender when Gmail credentials are missing", () => {
    delete process.env.GMAIL_USER
    delete process.env.GMAIL_APP_PASSWORD
    expect(getEmailSender()).toBeInstanceOf(LogEmailSender)
  })

  it("falls back to LogEmailSender when only one of the two credentials is set", () => {
    process.env.GMAIL_USER = "demo@gmail.com"
    delete process.env.GMAIL_APP_PASSWORD
    expect(getEmailSender()).toBeInstanceOf(LogEmailSender)
  })

  it("uses GmailSmtpSender when both credentials are set", () => {
    process.env.GMAIL_USER = "demo@gmail.com"
    process.env.GMAIL_APP_PASSWORD = "app-password"
    expect(getEmailSender()).toBeInstanceOf(GmailSmtpSender)
  })

  it("caches the instance across calls", () => {
    delete process.env.GMAIL_USER
    delete process.env.GMAIL_APP_PASSWORD
    expect(getEmailSender()).toBe(getEmailSender())
  })
})
