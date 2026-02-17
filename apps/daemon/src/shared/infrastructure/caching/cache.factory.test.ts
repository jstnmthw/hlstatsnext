/**
 * Cache Factory Unit Tests
 */

import { createMockLogger } from "@/tests/mocks/logger"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createCacheService, getCacheConfigFromEnv, type CacheFactoryConfig } from "./cache.factory"
import { NullCacheService } from "./null-cache.service"

describe("Cache Factory", () => {
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
  })

  describe("createCacheService", () => {
    it("should return NullCacheService when disabled", () => {
      const config: CacheFactoryConfig = {
        enabled: false,
        host: "localhost",
        port: 6379,
        keyPrefix: "hlstats:",
        defaultTtl: 3600,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      }

      const service = createCacheService(config, mockLogger)
      expect(service).toBeInstanceOf(NullCacheService)
      expect(mockLogger.info).toHaveBeenCalledWith("Cache service disabled - using null cache")
    })

    it("should return a cache service when enabled", () => {
      const config: CacheFactoryConfig = {
        enabled: true,
        host: "localhost",
        port: 6379,
        keyPrefix: "hlstats:",
        defaultTtl: 3600,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      }

      const service = createCacheService(config, mockLogger)
      // When enabled, should NOT be a NullCacheService
      expect(service).not.toBeInstanceOf(NullCacheService)
      expect(service).toBeDefined()
    })

    it("should not log disabled message when enabled", () => {
      const config: CacheFactoryConfig = {
        enabled: true,
        host: "redis.example.com",
        port: 6380,
        password: "secret123",
        keyPrefix: "test:",
        defaultTtl: 1800,
        retryDelayOnFailover: 200,
        maxRetriesPerRequest: 5,
      }

      createCacheService(config, mockLogger)
      expect(mockLogger.info).not.toHaveBeenCalledWith("Cache service disabled - using null cache")
    })
  })

  describe("getCacheConfigFromEnv", () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it("should return defaults when no env vars are set", () => {
      vi.stubEnv("CACHE_ENABLED", "")
      vi.stubEnv("CACHE_HOST", "")
      vi.stubEnv("CACHE_PORT", "")
      vi.stubEnv("CACHE_KEY_PREFIX", "")
      vi.stubEnv("CACHE_DEFAULT_TTL", "")
      vi.stubEnv("CACHE_RETRY_DELAY", "")
      vi.stubEnv("CACHE_MAX_RETRIES", "")

      const config = getCacheConfigFromEnv()

      expect(config.enabled).toBe(false)
      expect(config.host).toBe("localhost")
      expect(config.port).toBe(6379)
      expect(config.keyPrefix).toBe("hlstats:")
      expect(config.defaultTtl).toBe(3600)
      expect(config.retryDelayOnFailover).toBe(100)
      expect(config.maxRetriesPerRequest).toBe(3)
    })

    it("should parse CACHE_ENABLED=true", () => {
      vi.stubEnv("CACHE_ENABLED", "true")
      expect(getCacheConfigFromEnv().enabled).toBe(true)
    })

    it("should parse CACHE_ENABLED=TRUE (case insensitive)", () => {
      vi.stubEnv("CACHE_ENABLED", "TRUE")
      expect(getCacheConfigFromEnv().enabled).toBe(true)
    })

    it("should treat CACHE_ENABLED=false as disabled", () => {
      vi.stubEnv("CACHE_ENABLED", "false")
      expect(getCacheConfigFromEnv().enabled).toBe(false)
    })

    it("should parse numeric env vars", () => {
      vi.stubEnv("CACHE_PORT", "6380")
      vi.stubEnv("CACHE_DEFAULT_TTL", "7200")
      vi.stubEnv("CACHE_RETRY_DELAY", "500")
      vi.stubEnv("CACHE_MAX_RETRIES", "10")

      const config = getCacheConfigFromEnv()
      expect(config.port).toBe(6380)
      expect(config.defaultTtl).toBe(7200)
      expect(config.retryDelayOnFailover).toBe(500)
      expect(config.maxRetriesPerRequest).toBe(10)
    })

    it("should use custom host and key prefix", () => {
      vi.stubEnv("CACHE_HOST", "redis.example.com")
      vi.stubEnv("CACHE_KEY_PREFIX", "myapp:")

      const config = getCacheConfigFromEnv()
      expect(config.host).toBe("redis.example.com")
      expect(config.keyPrefix).toBe("myapp:")
    })

    it("should pass through CACHE_PASSWORD", () => {
      vi.stubEnv("CACHE_PASSWORD", "supersecret")
      expect(getCacheConfigFromEnv().password).toBe("supersecret")
    })
  })
})
