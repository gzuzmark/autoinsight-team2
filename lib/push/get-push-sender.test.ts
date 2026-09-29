import { afterEach, beforeEach, describe, expect, it } from "vitest"
import webpush from "web-push"
import { getPushSender, resetPushSenderForTests } from "@/lib/push/get-push-sender"
import { LogPushSender } from "@/lib/push/log-sender"
import { WebPushSender } from "@/lib/push/webpush-sender"

const ORIGINAL_ENV = { ...process.env }
// A throwaway VAPID keypair generated only for this test run -- never
// committed anywhere, never reused as a real key (see the brief's "generate
// throwaway VAPID keys only inside tests/inline env" instruction).
const { publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE } = webpush.generateVAPIDKeys()

describe("getPushSender", () => {
  beforeEach(() => {
    resetPushSenderForTests()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    resetPushSenderForTests()
  })

  it("falls back to LogPushSender when VAPID keys are missing", () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    expect(getPushSender()).toBeInstanceOf(LogPushSender)
  })

  it("falls back to LogPushSender when only one of the two keys is set", () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub"
    delete process.env.VAPID_PRIVATE_KEY
    expect(getPushSender()).toBeInstanceOf(LogPushSender)
  })

  it("uses WebPushSender when both VAPID keys are set", () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = VAPID_PUBLIC
    process.env.VAPID_PRIVATE_KEY = VAPID_PRIVATE
    expect(getPushSender()).toBeInstanceOf(WebPushSender)
  })

  it("caches the instance across calls", () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    expect(getPushSender()).toBe(getPushSender())
  })
})
