/**
 * Integration Test Global Setup
 *
 * Runs before/after integration tests to manage the real test database.
 * Requires MySQL running on port 3307 (see docker-compose.test.yml).
 */

import { afterAll, afterEach, beforeAll, vi } from "vitest"
import { seedMinimalData } from "./helpers/seed"
import { cleanAllTables, disconnectTestDb, getTestDb } from "./helpers/test-db"

beforeAll(async () => {
  // Point at the test database
  process.env.NODE_ENV = "test"
  process.env.LOG_LEVEL = "silent"
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "mysql://hlstatsnext:changeme@localhost:3307/hlstatsnext_test"
  process.env.ENCRYPTION_KEY = "UeiKre+QpJAdqs8HECeQsuhJGOEatW+gu/t0pXPE5ns="

  // Verify connectivity
  const db = getTestDb()
  try {
    await db.$queryRaw`SELECT 1`
  } catch (error) {
    throw new Error(
      `Cannot connect to test database. Is MySQL running on port 3307?\n` +
        `Run: docker compose -f docker-compose.test.yml up -d\n` +
        `Then: pnpm db:test:prepare\n` +
        `Original error: ${error}`,
    )
  }

  // Clean transactional tables before seeding in case a previous run left data
  await cleanAllTables()

  // Seed reference data
  await seedMinimalData(db)
})

afterEach(async () => {
  await cleanAllTables()
  vi.clearAllMocks()
})

afterAll(async () => {
  await disconnectTestDb()
})
