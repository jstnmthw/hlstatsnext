/**
 * E2E Test Global Setup
 *
 * Extends integration setup with RabbitMQ and Garnet (cache) env vars.
 * Requires all services from docker-compose.test.yml.
 */

import { afterAll, afterEach, beforeAll, vi } from "vitest"
import { seedMinimalData } from "../integration/helpers/seed"
import { cleanAllTables, disconnectTestDb, getTestDb } from "../integration/helpers/test-db"

beforeAll(async () => {
  // Database
  process.env.NODE_ENV = "test"
  process.env.LOG_LEVEL = "silent"
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "mysql://hlstatsnext:changeme@localhost:3307/hlstatsnext_test"
  process.env.ENCRYPTION_KEY = "UeiKre+QpJAdqs8HECeQsuhJGOEatW+gu/t0pXPE5ns="

  // RabbitMQ
  process.env.RABBITMQ_URL =
    process.env.RABBITMQ_URL || "amqp://hlstats:hlstats@localhost:5673/hlstats"

  // Garnet / Redis cache
  process.env.CACHE_ENABLED = "true"
  process.env.CACHE_HOST = process.env.CACHE_HOST || "localhost"
  process.env.CACHE_PORT = process.env.CACHE_PORT || "6380"

  // Verify DB connectivity
  const db = getTestDb()
  try {
    await db.$queryRaw`SELECT 1`
  } catch (error) {
    throw new Error(
      `Cannot connect to test database. Are all services running?\n` +
        `Run: docker compose -f docker-compose.test.yml up -d\n` +
        `Then: pnpm db:test:prepare\n` +
        `Original error: ${error}`,
    )
  }

  await seedMinimalData(db)
})

afterEach(async () => {
  await cleanAllTables()
  vi.clearAllMocks()
})

afterAll(async () => {
  await disconnectTestDb()
})
