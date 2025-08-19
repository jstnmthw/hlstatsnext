/**
 * RCON Configuration Factory Tests
 *
 * Tests for environment variable parsing and validation logic
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createRconConfig } from "./rcon-config.factory"

describe("createRconConfig", () => {
  // Store original environment
  const originalEnv = process.env

  beforeEach(() => {
    // Clear environment variables
    process.env = {}
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe("with default values", () => {
    it("should return default configuration when no environment variables are set", () => {
      const config = createRconConfig()

      expect(config).toEqual({
        enabled: false,
        timeout: 5000,
        maxRetries: 3,
        statusInterval: 30000,
        maxConnectionsPerServer: 1,
      })
    })
  })

  describe("enabled flag", () => {
    it("should enable RCON when RCON_ENABLED is 'true'", () => {
      process.env.RCON_ENABLED = "true"

      const config = createRconConfig()

      expect(config.enabled).toBe(true)
    })

    it("should disable RCON when RCON_ENABLED is any other value", () => {
      process.env.RCON_ENABLED = "false"

      const config = createRconConfig()

      expect(config.enabled).toBe(false)
    })
  })

  describe("timeout parsing", () => {
    it("should parse valid timeout value", () => {
      process.env.RCON_TIMEOUT = "10000"

      const config = createRconConfig()

      expect(config.timeout).toBe(10000)
    })

    it("should throw error for invalid timeout value", () => {
      process.env.RCON_TIMEOUT = "invalid"

      expect(() => createRconConfig()).toThrow("Invalid RCON_TIMEOUT: invalid")
    })

    it("should throw error for negative timeout value", () => {
      process.env.RCON_TIMEOUT = "-1000"

      expect(() => createRconConfig()).toThrow("Invalid RCON_TIMEOUT: -1000")
    })
  })

  describe("maxRetries parsing", () => {
    it("should parse valid maxRetries value", () => {
      process.env.RCON_MAX_RETRIES = "5"

      const config = createRconConfig()

      expect(config.maxRetries).toBe(5)
    })

    it("should allow zero retries", () => {
      process.env.RCON_MAX_RETRIES = "0"

      const config = createRconConfig()

      expect(config.maxRetries).toBe(0)
    })

    it("should throw error for invalid maxRetries value", () => {
      process.env.RCON_MAX_RETRIES = "invalid"

      expect(() => createRconConfig()).toThrow("Invalid RCON_MAX_RETRIES: invalid")
    })

    it("should throw error for negative maxRetries value", () => {
      process.env.RCON_MAX_RETRIES = "-1"

      expect(() => createRconConfig()).toThrow("Invalid RCON_MAX_RETRIES: -1")
    })
  })

  describe("statusInterval parsing", () => {
    it("should parse valid statusInterval value", () => {
      process.env.RCON_STATUS_INTERVAL = "60000"

      const config = createRconConfig()

      expect(config.statusInterval).toBe(60000)
    })

    it("should throw error for invalid statusInterval value", () => {
      process.env.RCON_STATUS_INTERVAL = "invalid"

      expect(() => createRconConfig()).toThrow("Invalid RCON_STATUS_INTERVAL: invalid")
    })

    it("should throw error for zero or negative statusInterval value", () => {
      process.env.RCON_STATUS_INTERVAL = "0"

      expect(() => createRconConfig()).toThrow("Invalid RCON_STATUS_INTERVAL: 0")
    })
  })
})
