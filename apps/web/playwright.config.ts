import { defineConfig, devices } from "@playwright/test"

const webPort = 3100
const apiPort = 4100
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${webPort}`
const graphqlURL = `http://localhost:${apiPort}/graphql`

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL,
    navigationTimeout: 60_000,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Ports of their own, so a run never shares a server with `pnpm dev`. Better
  // Auth must be told the origin the browser will use, hence BETTER_AUTH_URL.
  // Readiness is probed on pages that need no API, and on the API's health query.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: "pnpm dev",
          cwd: "../api",
          url: `${graphqlURL}?query=%7Bhealth%7Bstatus%7D%7D`,
          reuseExistingServer: true,
          timeout: 120_000,
          env: { PORT: String(apiPort) },
        },
        {
          command: `pnpm exec next dev --port ${webPort}`,
          url: `${baseURL}/login`,
          reuseExistingServer: true,
          timeout: 120_000,
          env: { BETTER_AUTH_URL: baseURL, NEXT_PUBLIC_GRAPHQL_URL: graphqlURL },
        },
      ],
})
