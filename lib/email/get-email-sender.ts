import "server-only"

import { GmailSmtpSender } from "@/lib/email/gmail-sender"
import { LogEmailSender } from "@/lib/email/log-sender"
import type { EmailSender } from "@/lib/email/sender"

/**
 * G6 composition root for the mailer port, same globalThis-singleton
 * pattern as `getFloorRepository()` (lib/floor-repository.ts) -- avoids
 * dev-mode's separate-bundle-per-layer problem re-creating the sender (and
 * losing `LogEmailSender#enviados`) on every request.
 */
const GLOBAL_KEY = Symbol.for("autoinsight.emailSender")
type GlobalWithSender = typeof globalThis & { [GLOBAL_KEY]?: EmailSender }

export function getEmailSender(): EmailSender {
  const g = globalThis as GlobalWithSender
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createEmailSender()
  }
  return g[GLOBAL_KEY]
}

function createEmailSender(): EmailSender {
  const user = process.env.GMAIL_USER
  const appPassword = process.env.GMAIL_APP_PASSWORD
  if (user && appPassword) {
    return new GmailSmtpSender(user, appPassword)
  }
  // Missing/partial credentials: never throws, just skips real delivery
  // (see LogEmailSender's doc) -- a facilitator running mock mode locally
  // must not need Gmail creds for the rest of the back office to work.
  return new LogEmailSender()
}

/** Test seam, same rationale as `resetFloorRepositoryForTests` clearing the
 * singleton. */
export function resetEmailSenderForTests(): void {
  delete (globalThis as GlobalWithSender)[GLOBAL_KEY]
}

/** Test seam, same rationale as `setFloorRepositoryForTests`: route tests
 * inject a fake sender (e.g. one whose `send` rejects) instead of depending
 * on real Gmail credentials or LogEmailSender's console output. */
export function setEmailSenderForTests(sender: EmailSender): void {
  ;(globalThis as GlobalWithSender)[GLOBAL_KEY] = sender
}
