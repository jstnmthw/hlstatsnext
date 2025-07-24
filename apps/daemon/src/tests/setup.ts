/**
 * Global Test Setup
 *
 * Configures the testing environment for Vitest with proper database
 * connection, cleanup, and global mocks.
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import { resetAppContext } from "../context"
import { cleanupDatabase, seedTestDatabase } from "../tests/fixtures/database"

// Global setup - runs once before all tests
beforeAll(async () => {
  // Load test environment variables
  process.env.NODE_ENV = "test"
  process.env.LOG_LEVEL = "silent"

  // Initialize test database
  await seedTestDatabase()
})

// Global cleanup - runs once after all tests
afterAll(async () => {
  await cleanupDatabase()
})

// Test isolation - runs before each test
beforeEach(() => {
  // Reset application context for clean state
  resetAppContext()
})

// Cleanup after each test
afterEach(async () => {
  // Clear any timers, intervals, etc.
  vi.clearAllTimers()
  vi.clearAllMocks()
})
