import { createRequire } from "node:module"
import { defineConfig } from "vitest/config"

const require = createRequire(import.meta.url)
// The exact file, not the package directory: a directory would be re-resolved
// through package.json and land on the ESM build again.
const graphqlEntry = require.resolve("graphql")

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/integration/**/*.integration.test.ts"],
    testTimeout: 30_000,
    pool: "forks",
    env: {
      // The schema under test is the real one, so point Prisma somewhere that
      // cannot answer: a guard that fails would surface as a connection error,
      // never as a write to a development database.
      DATABASE_URL: "mysql://guard:guard@127.0.0.1:1/guard",
    },
  },
  resolve: {
    // Pothos requires graphql's CommonJS build while Vite would resolve its ESM
    // build for the test file. GraphQL refuses types from "another realm", so
    // every import must land on the same file.
    alias: [{ find: /^graphql$/, replacement: graphqlEntry }],
  },
})
