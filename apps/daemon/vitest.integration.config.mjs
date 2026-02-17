import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/integration/**/*.integration.test.ts"],
    setupFiles: ["./src/tests/integration/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    isolate: true,
    sequence: {
      concurrent: false,
    },
    pool: "forks",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
