import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup-test-env.ts"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/database/client.ts", "src/types/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
})
