import type { MetadataRoute } from "next"

/**
 * G7b: web app manifest so an office user can "Add to Home Screen" (needed
 * on iOS Safari for push -- see the README's "Web push notifications"
 * section for the iOS limitation: push only works after the app is added
 * to the Home Screen and opened from there, and only on iOS 16.4+).
 * `start_url` points at the office desk view (the only screen this
 * manifest/push feature targets, not the floor tablet or `/backoffice`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AutoInsight",
    short_name: "AutoInsight",
    description: "AutoInsight -- panel de calidad de planta",
    start_url: "/oficina",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#4338ca",
    icons: [
      { src: "/icon-light-32x32.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
