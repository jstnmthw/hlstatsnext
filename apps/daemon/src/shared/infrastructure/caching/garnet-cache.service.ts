/**
 * Garnet Cache Service
 *
 * High-performance Redis-compatible caching service using Microsoft Garnet.
 * Provides type-safe caching operations with automatic serialization/deserialization.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import Redis from "ioredis"

export interface CacheConfig {
  host: string
  port: number
  password?: string
  keyPrefix?: string
  defaultTtl?: number
  retryDelayOnFailover?: number
  maxRetriesPerRequest?: number
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttl?: number): Promise<void>
  del(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  mget<T>(keys: string[]): Promise<(T | null)[]>
  mset<T>(keyValuePairs: Array<{ key: string; value: T; ttl?: number }>): Promise<void>
  invalidatePattern(pattern: string): Promise<void>
  flushAll(): Promise<void>
  ping(): Promise<boolean>
  disconnect(): Promise<void>
}

/**
 * Garnet-based cache service implementation
 */
export class GarnetCacheService implements ICacheService {
  private client: Redis
  private readonly logger: ILogger
  private readonly config: CacheConfig
  private isConnected = false

  constructor(config: CacheConfig, logger: ILogger) {
    this.config = {
      defaultTtl: 3600, // 1 hour default
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      ...config,
    }
    this.logger = logger

    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      keyPrefix: this.config.keyPrefix,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      lazyConnect: true,
      enableReadyCheck: true,
    })

    this.setupEventHandlers()
  }

  /**
   * Initialize connection to Garnet
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect()
      this.isConnected = true
      this.logger.ok("Connected to Garnet cache server")
    } catch (error) {
      this.logger.error("Failed to connect to Garnet cache server", {
        error: error instanceof Error ? error.message : String(error),
        host: this.config.host,
        port: this.config.port,
      })
      throw error
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key)
      if (value === null) {
        return null
      }
      return JSON.parse(value) as T
    } catch (error) {
      this.logger.error("Cache get operation failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value)
      const expirationTime = ttl || this.config.defaultTtl!

      if (expirationTime > 0) {
        await this.client.setex(key, expirationTime, serializedValue)
      } else {
        await this.client.set(key, serializedValue)
      }
    } catch (error) {
      this.logger.error("Cache set operation failed", {
        key,
        ttl,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key)
    } catch (error) {
      this.logger.error("Cache delete operation failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key)
      return result === 1
    } catch (error) {
      this.logger.error("Cache exists operation failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mget(...keys)
      return values.map((value) => {
        if (value === null) {
          return null
        }
        try {
          return JSON.parse(value) as T
        } catch {
          return null
        }
      })
    } catch (error) {
      this.logger.error("Cache mget operation failed", {
        keys,
        error: error instanceof Error ? error.message : String(error),
      })
      return keys.map(() => null)
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(keyValuePairs: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    try {
      const pipeline = this.client.pipeline()

      for (const { key, value, ttl } of keyValuePairs) {
        const serializedValue = JSON.stringify(value)
        const expirationTime = ttl || this.config.defaultTtl!

        if (expirationTime > 0) {
          pipeline.setex(key, expirationTime, serializedValue)
        } else {
          pipeline.set(key, serializedValue)
        }
      }

      await pipeline.exec()
    } catch (error) {
      this.logger.error("Cache mset operation failed", {
        keyCount: keyValuePairs.length,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Invalidate all keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern)
      if (keys.length > 0) {
        await this.client.del(...keys)
        this.logger.debug("Invalidated cache keys", {
          pattern,
          keyCount: keys.length,
        })
      }
    } catch (error) {
      this.logger.error("Cache pattern invalidation failed", {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Clear all cache entries
   */
  async flushAll(): Promise<void> {
    try {
      await this.client.flushall()
      this.logger.info("Cache flushed completely")
    } catch (error) {
      this.logger.error("Cache flush operation failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Test connection to cache server
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping()
      return result === "PONG"
    } catch (error) {
      this.logger.error("Cache ping failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Disconnect from cache server
   */
  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect()
        this.isConnected = false
        this.logger.info("Disconnected from Garnet cache server")
      }
    } catch (error) {
      this.logger.error("Error disconnecting from cache server", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on("connect", () => {
      this.logger.info("Connecting to Garnet cache server...")
    })

    this.client.on("ready", () => {
      this.isConnected = true
      this.logger.ok("Garnet cache server ready")
    })

    this.client.on("error", (error) => {
      this.logger.error("Garnet cache server error", {
        error: error.message,
      })
    })

    this.client.on("close", () => {
      this.isConnected = false
      this.logger.warn("Garnet cache server connection closed")
    })

    this.client.on("reconnecting", () => {
      this.logger.info("Reconnecting to Garnet cache server...")
    })
  }

  /**
   * Get connection status
   */
  get connected(): boolean {
    return this.isConnected
  }

  /**
   * Get cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config }
  }
}
