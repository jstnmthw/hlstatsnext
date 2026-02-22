/**
 * Global Test Setup
 *
 * Configures the testing environment for Vitest unit tests.
 * No external services (database, RabbitMQ, etc.) should be required here.
 */

import { afterEach, beforeEach, vi } from "vitest"
import { resetAppContext } from "../context"

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
