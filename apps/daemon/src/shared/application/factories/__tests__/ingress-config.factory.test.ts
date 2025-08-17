/**
 * Ingress Configuration Factory Tests
 * 
 * Tests for options resolution and environment variable fallbacks
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createIngressConfig } from "../ingress-config.factory"

describe("createIngressConfig", () => {
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
    it("should return default configuration when no options or environment variables are provided", () => {
      const config = createIngressConfig()

      expect(config).toEqual({
        port: 27500,
        host: "0.0.0.0",
        skipAuth: false,
        logBots: false,
      })
    })
  })

  describe("port resolution", () => {
    it("should use provided options port over environment and defaults", () => {
      process.env.INGRESS_PORT = "8080"

      const config = createIngressConfig({ port: 9000 })

      expect(config.port).toBe(9000)
    })

    it("should use environment port when no options port is provided", () => {
      process.env.INGRESS_PORT = "8080"

      const config = createIngressConfig()

      expect(config.port).toBe(8080)
    })

    it("should throw error for invalid environment port", () => {
      process.env.INGRESS_PORT = "invalid"

      expect(() => createIngressConfig()).toThrow("Invalid INGRESS_PORT: invalid")
    })

    it("should throw error for port out of range", () => {
      process.env.INGRESS_PORT = "70000"

      expect(() => createIngressConfig()).toThrow("Invalid INGRESS_PORT: 70000")
    })
  })

  describe("host resolution", () => {
    it("should use provided options host", () => {
      const config = createIngressConfig({ host: "localhost" })

      expect(config.host).toBe("localhost")
    })

    it("should use default host when no options host is provided", () => {
      const config = createIngressConfig()

      expect(config.host).toBe("0.0.0.0")
    })
  })

  describe("development environment detection", () => {
    it("should enable skipAuth and logBots in development environment", () => {
      process.env.NODE_ENV = "development"

      const config = createIngressConfig()

      expect(config.skipAuth).toBe(true)
      expect(config.logBots).toBe(true)
    })

    it("should disable skipAuth and logBots in production environment", () => {
      process.env.NODE_ENV = "production"

      const config = createIngressConfig()

      expect(config.skipAuth).toBe(false)
      expect(config.logBots).toBe(false)
    })

    it("should override environment with explicit options", () => {
      process.env.NODE_ENV = "development"

      const config = createIngressConfig({
        skipAuth: false,
        logBots: false,
      })

      expect(config.skipAuth).toBe(false)
      expect(config.logBots).toBe(false)
    })
  })
})