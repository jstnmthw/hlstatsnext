/**
 * Vitest Configuration
 */

import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/tests/",
        "src/types/",
        "dist/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/generated/**",
        "**/*.types.ts",
      ],
      thresholds: {
        global: {
          branches: 55,
          functions: 70,
          lines: 65,
          statements: 65,
        },
      },
    },
    pool: "forks",
    isolate: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
