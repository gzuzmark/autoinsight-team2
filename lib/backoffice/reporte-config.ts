import "server-only"

/** G6: default when APP_BASE_URL is unset (the deployed app). */
const DEFAULT_APP_BASE_URL = "https://autoinsight-team2-nine.vercel.app"

/** G6: default when REPORT_RECIPIENTS is unset -- a public Mailinator
 * inbox for the demo (see the README's "Shift report email" section). */
const DEFAULT_RECIPIENT = "demo-autoinsight@mailinator.com"

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? DEFAULT_APP_BASE_URL
}

export function reportRecipients(): string[] {
  const raw = process.env.REPORT_RECIPIENTS
  if (!raw) return [DEFAULT_RECIPIENT]
  const lista = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return lista.length > 0 ? lista : [DEFAULT_RECIPIENT]
}
