/**
 * Null Cache Service Tests
 *
 * Tests for the no-op cache implementation.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it } from "vitest"
import { NullCacheService } from "./null-cache.service"

describe("NullCacheService", () => {
  let service: NullCacheService
  let mockLogger: ILogger

  beforeEach(() => {
    mockLogger = createMockLogger()
    service = new NullCacheService(mockLogger)
  })

  describe("constructor", () => {
    it("should log debug message on initialization", () => {
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Null cache service initialized - no caching will be performed",
      )
    })
  })

  describe("get", () => {
    it("should always return null", async () => {
      const result = await service.get<string>("any-key")
      expect(result).toBeNull()
    })

    it("should return null regardless of key", async () => {
      expect(await service.get<number>("key1")).toBeNull()
      expect(await service.get<object>("key2")).toBeNull()
      expect(await service.get<boolean>("key3")).toBeNull()
    })
  })

  describe("set", () => {
    it("should complete without error", async () => {
      await expect(service.set("key", "value")).resolves.toBeUndefined()
    })

    it("should complete without error with TTL", async () => {
      await expect(service.set("key", { data: "test" }, 3600)).resolves.toBeUndefined()
    })
  })

  describe("del", () => {
    it("should complete without error", async () => {
      await expect(service.del("key")).resolves.toBeUndefined()
    })
  })

  describe("exists", () => {
    it("should always return false", async () => {
      const result = await service.exists("any-key")
      expect(result).toBe(false)
    })
  })

  describe("mget", () => {
    it("should return array of nulls matching input length", async () => {
      const keys = ["key1", "key2", "key3"]
      const result = await service.mget<string>(keys)
      expect(result).toEqual([null, null, null])
      expect(result).toHaveLength(3)
    })

    it("should return empty array for empty input", async () => {
      const result = await service.mget<string>([])
      expect(result).toEqual([])
    })
  })

  describe("mset", () => {
    it("should complete without error", async () => {
      const pairs = [
        { key: "key1", value: "value1" },
        { key: "key2", value: "value2", ttl: 300 },
      ]
      await expect(service.mset(pairs)).resolves.toBeUndefined()
    })
  })

  describe("invalidatePattern", () => {
    it("should complete without error", async () => {
      await expect(service.invalidatePattern("user:*")).resolves.toBeUndefined()
    })
  })

  describe("flushAll", () => {
    it("should complete without error", async () => {
      await expect(service.flushAll()).resolves.toBeUndefined()
    })
  })

  describe("ping", () => {
    it("should always return true", async () => {
      const result = await service.ping()
      expect(result).toBe(true)
    })
  })

  describe("disconnect", () => {
    it("should complete without error", async () => {
      await expect(service.disconnect()).resolves.toBeUndefined()
    })
  })
})
