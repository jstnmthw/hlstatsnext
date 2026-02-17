/**
 * GarnetCacheService Unit Tests
 *
 * Comprehensive tests covering all cache operations, event handlers,
 * connection management, and error handling branches.
 */

import { createMockLogger } from "@/tests/mocks/logger"
import Redis from "ioredis"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GarnetCacheService, type CacheConfig } from "./garnet-cache.service"

// Instead of mocking the entire ioredis module (which has CJS interop issues),
// we spy on the Redis prototype methods directly
vi.spyOn(Redis.prototype, "connect").mockResolvedValue()
vi.spyOn(Redis.prototype, "get").mockResolvedValue(null)
vi.spyOn(Redis.prototype, "set").mockResolvedValue("OK")
vi.spyOn(Redis.prototype, "setex").mockResolvedValue("OK")
vi.spyOn(Redis.prototype, "del").mockResolvedValue(0)
vi.spyOn(Redis.prototype, "exists").mockResolvedValue(0)
vi.spyOn(Redis.prototype, "mget").mockResolvedValue([])
vi.spyOn(Redis.prototype, "keys").mockResolvedValue([])
vi.spyOn(Redis.prototype, "flushall").mockResolvedValue("OK")
vi.spyOn(Redis.prototype, "ping").mockResolvedValue("PONG")
vi.spyOn(Redis.prototype, "disconnect").mockResolvedValue()
vi.spyOn(Redis.prototype, "pipeline").mockReturnValue({
  setex: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
} as never)

describe("GarnetCacheService", () => {
  let service: GarnetCacheService
  let logger: ReturnType<typeof createMockLogger>
  let config: CacheConfig
  let eventHandlers: Record<string, (...args: unknown[]) => void>

  beforeEach(() => {
    vi.clearAllMocks()

    logger = createMockLogger()

    config = {
      host: "localhost",
      port: 6379,
      keyPrefix: "test:",
      defaultTtl: 3600,
    }

    // Capture event handlers set up by the constructor
    eventHandlers = {}
    vi.spyOn(Redis.prototype, "on").mockImplementation(function (
      this: Redis,
      event: string,
      handler: (...args: unknown[]) => void,
    ) {
      eventHandlers[event] = handler
      return this
    } as never)

    // Re-mock all prototype methods for clean state
    vi.spyOn(Redis.prototype, "connect").mockResolvedValue()
    vi.spyOn(Redis.prototype, "get").mockResolvedValue(null)
    vi.spyOn(Redis.prototype, "set").mockResolvedValue("OK")
    vi.spyOn(Redis.prototype, "setex").mockResolvedValue("OK")
    vi.spyOn(Redis.prototype, "del").mockResolvedValue(0)
    vi.spyOn(Redis.prototype, "exists").mockResolvedValue(0)
    vi.spyOn(Redis.prototype, "mget").mockResolvedValue([])
    vi.spyOn(Redis.prototype, "keys").mockResolvedValue([])
    vi.spyOn(Redis.prototype, "flushall").mockResolvedValue("OK")
    vi.spyOn(Redis.prototype, "ping").mockResolvedValue("PONG")
    vi.spyOn(Redis.prototype, "disconnect").mockResolvedValue()

    service = new GarnetCacheService(config, logger)
  })

  describe("constructor", () => {
    it("should create instance with provided config including defaults", () => {
      const cfg = service.getConfig()
      expect(cfg.host).toBe("localhost")
      expect(cfg.port).toBe(6379)
      expect(cfg.keyPrefix).toBe("test:")
      expect(cfg.defaultTtl).toBe(3600)
      expect(cfg.retryDelayOnFailover).toBe(100)
      expect(cfg.maxRetriesPerRequest).toBe(3)
    })

    it("should use default values when not provided", () => {
      const minConfig: CacheConfig = { host: "127.0.0.1", port: 6380 }
      const minService = new GarnetCacheService(minConfig, logger)
      const cfg = minService.getConfig()
      expect(cfg.defaultTtl).toBe(3600)
      expect(cfg.retryDelayOnFailover).toBe(100)
      expect(cfg.maxRetriesPerRequest).toBe(3)
    })

    it("should allow overriding default values", () => {
      const customConfig: CacheConfig = {
        host: "custom",
        port: 7000,
        defaultTtl: 7200,
        retryDelayOnFailover: 200,
        maxRetriesPerRequest: 5,
      }
      const customService = new GarnetCacheService(customConfig, logger)
      const cfg = customService.getConfig()
      expect(cfg.defaultTtl).toBe(7200)
      expect(cfg.retryDelayOnFailover).toBe(200)
      expect(cfg.maxRetriesPerRequest).toBe(5)
    })

    it("should setup event handlers on Redis client", () => {
      expect(eventHandlers["connect"]).toBeDefined()
      expect(eventHandlers["ready"]).toBeDefined()
      expect(eventHandlers["error"]).toBeDefined()
      expect(eventHandlers["close"]).toBeDefined()
      expect(eventHandlers["reconnecting"]).toBeDefined()
    })
  })

  describe("setupEventHandlers", () => {
    it("should log on connect event", () => {
      eventHandlers["connect"]!()
      expect(logger.info).toHaveBeenCalledWith("Connecting to Garnet cache server...")
    })

    it("should set isConnected and log on ready event", () => {
      eventHandlers["ready"]!()
      expect(logger.ok).toHaveBeenCalledWith("Garnet cache server ready")
      expect(service.connected).toBe(true)
    })

    it("should log on error event", () => {
      eventHandlers["error"]!(new Error("Redis error"))
      expect(logger.error).toHaveBeenCalledWith("Garnet cache server error", {
        error: "Redis error",
      })
    })

    it("should set isConnected false and log on close event", () => {
      eventHandlers["ready"]!()
      expect(service.connected).toBe(true)
      eventHandlers["close"]!()
      expect(logger.warn).toHaveBeenCalledWith("Garnet cache server connection closed")
      expect(service.connected).toBe(false)
    })

    it("should log on reconnecting event", () => {
      eventHandlers["reconnecting"]!()
      expect(logger.info).toHaveBeenCalledWith("Reconnecting to Garnet cache server...")
    })
  })

  describe("connect", () => {
    it("should connect successfully", async () => {
      vi.mocked(Redis.prototype.connect).mockResolvedValue()
      await service.connect()
      expect(Redis.prototype.connect).toHaveBeenCalled()
      expect(service.connected).toBe(true)
      expect(logger.ok).toHaveBeenCalledWith("Connected to Garnet cache server")
    })

    it("should handle connection error with Error instance", async () => {
      vi.mocked(Redis.prototype.connect).mockRejectedValue(new Error("Connection refused"))
      await expect(service.connect()).rejects.toThrow("Connection refused")
      expect(logger.error).toHaveBeenCalledWith("Failed to connect to Garnet cache server", {
        error: "Connection refused",
        host: "localhost",
        port: 6379,
      })
    })

    it("should handle connection error with non-Error value", async () => {
      vi.mocked(Redis.prototype.connect).mockRejectedValue("string error")
      await expect(service.connect()).rejects.toBe("string error")
      expect(logger.error).toHaveBeenCalledWith("Failed to connect to Garnet cache server", {
        error: "string error",
        host: "localhost",
        port: 6379,
      })
    })
  })

  describe("get", () => {
    it("should return parsed value when key exists", async () => {
      vi.mocked(Redis.prototype.get).mockResolvedValue(JSON.stringify({ foo: "bar" }))
      const result = await service.get<{ foo: string }>("test-key")
      expect(result).toEqual({ foo: "bar" })
    })

    it("should return null when key does not exist", async () => {
      vi.mocked(Redis.prototype.get).mockResolvedValue(null)
      expect(await service.get("test-key")).toBeNull()
    })

    it("should return null and log error on failure with Error instance", async () => {
      vi.mocked(Redis.prototype.get).mockRejectedValue(new Error("Redis error"))
      expect(await service.get("test-key")).toBeNull()
      expect(logger.error).toHaveBeenCalledWith("Cache get operation failed", {
        key: "test-key",
        error: "Redis error",
      })
    })

    it("should return null and log error on failure with non-Error value", async () => {
      vi.mocked(Redis.prototype.get).mockRejectedValue(42)
      expect(await service.get("test-key")).toBeNull()
      expect(logger.error).toHaveBeenCalledWith("Cache get operation failed", {
        key: "test-key",
        error: "42",
      })
    })
  })

  describe("set", () => {
    it("should use setex when TTL is positive", async () => {
      vi.mocked(Redis.prototype.setex).mockResolvedValue("OK")
      await service.set("key1", { value: 1 }, 600)
      expect(Redis.prototype.setex).toHaveBeenCalledWith("key1", 600, '{"value":1}')
    })

    it("should use default TTL when not provided", async () => {
      vi.mocked(Redis.prototype.setex).mockResolvedValue("OK")
      await service.set("key1", "hello")
      expect(Redis.prototype.setex).toHaveBeenCalledWith("key1", 3600, '"hello"')
    })

    it("should use plain set when expiration is 0", async () => {
      const zeroTtlConfig: CacheConfig = { host: "localhost", port: 6379, defaultTtl: 0 }
      const zeroTtlService = new GarnetCacheService(zeroTtlConfig, logger)
      vi.mocked(Redis.prototype.set).mockResolvedValue("OK")
      await zeroTtlService.set("key1", "data")
      expect(Redis.prototype.set).toHaveBeenCalledWith("key1", '"data"')
    })

    it("should throw and log on set failure with Error instance", async () => {
      vi.mocked(Redis.prototype.setex).mockRejectedValue(new Error("Write error"))
      await expect(service.set("key1", "data", 60)).rejects.toThrow("Write error")
      expect(logger.error).toHaveBeenCalledWith("Cache set operation failed", {
        key: "key1",
        ttl: 60,
        error: "Write error",
      })
    })

    it("should throw and log on set failure with non-Error value", async () => {
      vi.mocked(Redis.prototype.setex).mockRejectedValue("oops")
      await expect(service.set("key1", "data")).rejects.toBe("oops")
      expect(logger.error).toHaveBeenCalledWith("Cache set operation failed", {
        key: "key1",
        ttl: undefined,
        error: "oops",
      })
    })
  })

  describe("del", () => {
    it("should delete a key successfully", async () => {
      vi.mocked(Redis.prototype.del).mockResolvedValue(1)
      await service.del("key1")
      expect(Redis.prototype.del).toHaveBeenCalledWith("key1")
    })

    it("should throw and log on failure with Error", async () => {
      vi.mocked(Redis.prototype.del).mockRejectedValue(new Error("Del error"))
      await expect(service.del("key1")).rejects.toThrow("Del error")
      expect(logger.error).toHaveBeenCalledWith("Cache delete operation failed", {
        key: "key1",
        error: "Del error",
      })
    })

    it("should throw and log on failure with non-Error", async () => {
      vi.mocked(Redis.prototype.del).mockRejectedValue(999)
      await expect(service.del("key1")).rejects.toBe(999)
      expect(logger.error).toHaveBeenCalledWith("Cache delete operation failed", {
        key: "key1",
        error: "999",
      })
    })
  })

  describe("exists", () => {
    it("should return true when result === 1", async () => {
      vi.mocked(Redis.prototype.exists).mockResolvedValue(1)
      expect(await service.exists("key1")).toBe(true)
    })

    it("should return false when result !== 1", async () => {
      vi.mocked(Redis.prototype.exists).mockResolvedValue(0)
      expect(await service.exists("key1")).toBe(false)
    })

    it("should return false and log on Error", async () => {
      vi.mocked(Redis.prototype.exists).mockRejectedValue(new Error("Exists error"))
      expect(await service.exists("key1")).toBe(false)
      expect(logger.error).toHaveBeenCalledWith("Cache exists operation failed", {
        key: "key1",
        error: "Exists error",
      })
    })

    it("should return false and log on non-Error", async () => {
      vi.mocked(Redis.prototype.exists).mockRejectedValue("boom")
      expect(await service.exists("key1")).toBe(false)
      expect(logger.error).toHaveBeenCalledWith("Cache exists operation failed", {
        key: "key1",
        error: "boom",
      })
    })
  })

  describe("mget", () => {
    it("should return parsed values", async () => {
      vi.mocked(Redis.prototype.mget).mockResolvedValue([
        JSON.stringify({ a: 1 }),
        null,
        JSON.stringify({ b: 2 }),
      ])
      expect(await service.mget(["k1", "k2", "k3"])).toEqual([{ a: 1 }, null, { b: 2 }])
    })

    it("should return null for invalid JSON values", async () => {
      vi.mocked(Redis.prototype.mget).mockResolvedValue(["not-json", JSON.stringify(42)])
      expect(await service.mget(["k1", "k2"])).toEqual([null, 42])
    })

    it("should return all nulls on mget failure with Error", async () => {
      vi.mocked(Redis.prototype.mget).mockRejectedValue(new Error("MGet error"))
      expect(await service.mget(["k1", "k2"])).toEqual([null, null])
      expect(logger.error).toHaveBeenCalledWith("Cache mget operation failed", {
        keys: ["k1", "k2"],
        error: "MGet error",
      })
    })

    it("should return all nulls on mget failure with non-Error", async () => {
      vi.mocked(Redis.prototype.mget).mockRejectedValue("network failure")
      expect(await service.mget(["k1", "k2", "k3"])).toEqual([null, null, null])
      expect(logger.error).toHaveBeenCalledWith("Cache mget operation failed", {
        keys: ["k1", "k2", "k3"],
        error: "network failure",
      })
    })
  })

  describe("mset", () => {
    let mockPipeline: Record<string, ReturnType<typeof vi.fn>>

    beforeEach(() => {
      mockPipeline = {
        setex: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(Redis.prototype.pipeline).mockReturnValue(mockPipeline as never)
    })

    it("should use setex in pipeline when TTL is positive", async () => {
      await service.mset([
        { key: "k1", value: "v1", ttl: 120 },
        { key: "k2", value: "v2" },
      ])
      expect(mockPipeline.setex).toHaveBeenCalledWith("k1", 120, '"v1"')
      expect(mockPipeline.setex).toHaveBeenCalledWith("k2", 3600, '"v2"')
      expect(mockPipeline.exec).toHaveBeenCalled()
    })

    it("should use plain set when expiration is 0", async () => {
      const zeroTtlConfig: CacheConfig = { host: "localhost", port: 6379, defaultTtl: 0 }
      const zeroTtlService = new GarnetCacheService(zeroTtlConfig, logger)
      await zeroTtlService.mset([{ key: "k1", value: "v1" }])
      expect(mockPipeline.set).toHaveBeenCalledWith("k1", '"v1"')
    })

    it("should throw and log on mset failure with Error", async () => {
      mockPipeline.exec!.mockRejectedValue(new Error("Pipeline error"))
      await expect(service.mset([{ key: "k1", value: "v1" }])).rejects.toThrow("Pipeline error")
      expect(logger.error).toHaveBeenCalledWith("Cache mset operation failed", {
        keyCount: 1,
        error: "Pipeline error",
      })
    })

    it("should throw and log on mset failure with non-Error", async () => {
      mockPipeline.exec!.mockRejectedValue("pipe fail")
      await expect(service.mset([{ key: "k1", value: "v1" }])).rejects.toBe("pipe fail")
      expect(logger.error).toHaveBeenCalledWith("Cache mset operation failed", {
        keyCount: 1,
        error: "pipe fail",
      })
    })
  })

  describe("invalidatePattern", () => {
    it("should delete keys matching pattern", async () => {
      vi.mocked(Redis.prototype.keys).mockResolvedValue(["test:a", "test:b"])
      vi.mocked(Redis.prototype.del).mockResolvedValue(2)
      await service.invalidatePattern("test:*")
      expect(Redis.prototype.del).toHaveBeenCalledWith("test:a", "test:b")
      expect(logger.debug).toHaveBeenCalledWith("Invalidated cache keys", {
        pattern: "test:*",
        keyCount: 2,
      })
    })

    it("should skip deletion when no keys match", async () => {
      vi.mocked(Redis.prototype.keys).mockResolvedValue([])
      await service.invalidatePattern("nonexist:*")
      expect(Redis.prototype.del).not.toHaveBeenCalled()
    })

    it("should throw and log on failure with Error", async () => {
      vi.mocked(Redis.prototype.keys).mockRejectedValue(new Error("Keys error"))
      await expect(service.invalidatePattern("test:*")).rejects.toThrow("Keys error")
      expect(logger.error).toHaveBeenCalledWith("Cache pattern invalidation failed", {
        pattern: "test:*",
        error: "Keys error",
      })
    })

    it("should throw and log on failure with non-Error", async () => {
      vi.mocked(Redis.prototype.keys).mockRejectedValue(false)
      await expect(service.invalidatePattern("test:*")).rejects.toBe(false)
      expect(logger.error).toHaveBeenCalledWith("Cache pattern invalidation failed", {
        pattern: "test:*",
        error: "false",
      })
    })
  })

  describe("flushAll", () => {
    it("should flush successfully", async () => {
      vi.mocked(Redis.prototype.flushall).mockResolvedValue("OK")
      await service.flushAll()
      expect(logger.info).toHaveBeenCalledWith("Cache flushed completely")
    })

    it("should throw and log on failure with Error", async () => {
      vi.mocked(Redis.prototype.flushall).mockRejectedValue(new Error("Flush error"))
      await expect(service.flushAll()).rejects.toThrow("Flush error")
      expect(logger.error).toHaveBeenCalledWith("Cache flush operation failed", {
        error: "Flush error",
      })
    })

    it("should throw and log on failure with non-Error", async () => {
      vi.mocked(Redis.prototype.flushall).mockRejectedValue(null)
      await expect(service.flushAll()).rejects.toBeNull()
      expect(logger.error).toHaveBeenCalledWith("Cache flush operation failed", { error: "null" })
    })
  })

  describe("ping", () => {
    it("should return true when PONG", async () => {
      vi.mocked(Redis.prototype.ping).mockResolvedValue("PONG")
      expect(await service.ping()).toBe(true)
    })

    it("should return false when not PONG", async () => {
      vi.mocked(Redis.prototype.ping).mockResolvedValue("something-else")
      expect(await service.ping()).toBe(false)
    })

    it("should return false and log on Error", async () => {
      vi.mocked(Redis.prototype.ping).mockRejectedValue(new Error("Ping failed"))
      expect(await service.ping()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith("Cache ping failed", { error: "Ping failed" })
    })

    it("should return false and log on non-Error", async () => {
      vi.mocked(Redis.prototype.ping).mockRejectedValue(undefined)
      expect(await service.ping()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith("Cache ping failed", { error: "undefined" })
    })
  })

  describe("disconnect", () => {
    it("should disconnect when connected", async () => {
      vi.mocked(Redis.prototype.connect).mockResolvedValue()
      await service.connect()
      vi.mocked(Redis.prototype.disconnect).mockResolvedValue()
      await service.disconnect()
      expect(Redis.prototype.disconnect).toHaveBeenCalled()
      expect(service.connected).toBe(false)
      expect(logger.info).toHaveBeenCalledWith("Disconnected from Garnet cache server")
    })

    it("should not disconnect when not connected", async () => {
      await service.disconnect()
      expect(Redis.prototype.disconnect).not.toHaveBeenCalled()
    })

    it("should handle disconnect error with Error gracefully", async () => {
      vi.mocked(Redis.prototype.connect).mockResolvedValue()
      await service.connect()
      vi.mocked(Redis.prototype.disconnect).mockRejectedValue(new Error("Disconnect error"))
      await service.disconnect()
      expect(logger.error).toHaveBeenCalledWith("Error disconnecting from cache server", {
        error: "Disconnect error",
      })
    })

    it("should handle disconnect error with non-Error gracefully", async () => {
      vi.mocked(Redis.prototype.connect).mockResolvedValue()
      await service.connect()
      vi.mocked(Redis.prototype.disconnect).mockRejectedValue(123)
      await service.disconnect()
      expect(logger.error).toHaveBeenCalledWith("Error disconnecting from cache server", {
        error: "123",
      })
    })
  })

  describe("connected getter", () => {
    it("should return false initially", () => {
      expect(service.connected).toBe(false)
    })

    it("should return true after successful connect", async () => {
      vi.mocked(Redis.prototype.connect).mockResolvedValue()
      await service.connect()
      expect(service.connected).toBe(true)
    })
  })

  describe("getConfig", () => {
    it("should return a copy of the config", () => {
      const cfg = service.getConfig()
      expect(cfg).toEqual({
        host: "localhost",
        port: 6379,
        keyPrefix: "test:",
        defaultTtl: 3600,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      })
      cfg.host = "modified"
      expect(service.getConfig().host).toBe("localhost")
    })
  })
})
