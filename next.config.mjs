/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Dev-only: lets a tablet on the same LAN load dev assets (Next.js blocks
  // cross-origin requests to dev resources by default). Not used in
  // production builds. See node_modules/next/dist/docs/.../allowedDevOrigins.md.
  ...(process.env.NODE_ENV !== 'production' && {
    allowedDevOrigins: ['127.0.0.1', '192.168.*.*'],
  }),
}

export default nextConfig
