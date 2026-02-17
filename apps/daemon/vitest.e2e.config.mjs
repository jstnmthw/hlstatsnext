import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/e2e/**/*.e2e.test.ts"],
    setupFiles: ["./src/tests/e2e/setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
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
