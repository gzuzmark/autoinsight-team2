import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // "server-only" always throws on its default (non-"react-server")
      // export condition -- Next's bundler resolves it to a no-op via the
      // "react-server" condition in server bundles, but plain Node (this
      // test runner) does not set that condition. Route handler / adapter
      // tests need to import modules that carry this marker, so alias it to
      // the package's own empty no-op file for tests only; production
      // builds are unaffected (this file is not used by `next build`).
      "server-only": path.resolve(__dirname, "test/server-only-stub.js"),
    },
  },
  test: {
    environment: "node",
  },
})
