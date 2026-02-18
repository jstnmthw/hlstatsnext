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
    // Run test files one at a time so their beforeEach/afterEach DB
    // operations don't race against each other on the shared test DB.
    fileParallelism: false,
    pool: "forks",
    forks: {
      singleFork: true,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
