import path from "path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/lib/**/*.ts",
        "src/features/**/utils/**/*.ts",
        "src/features/**/lib/**/*.ts",
        "src/features/mock-data.ts",
        "src/features/servers/components/server-config.ts",
        "src/features/common/graphql/pagination.ts",
      ],
      exclude: [
        "node_modules/",
        "src/tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/*.test.ts",
        "src/lib/gql/**",
        "src/lib/apollo-client.ts",
        "src/lib/apollo-wrapper.tsx",
        "src/lib/mock-data.ts",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
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
