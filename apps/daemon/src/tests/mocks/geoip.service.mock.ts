/**
 * Mock GeoIP Service
 */

import { vi } from "vitest"

export const createMockGeoIPService = () => ({
  lookup: vi.fn(),
})
