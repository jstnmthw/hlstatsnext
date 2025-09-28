/**
 * Null Cache Service
 *
 * No-op cache implementation for when caching is disabled.
 * All operations return appropriate defaults without actual caching.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ILogger } from "@/shared/utils/logger.types"
import type { ICacheService } from "./garnet-cache.service"

/**
 * Null object pattern implementation for cache service
 */
export class NullCacheService implements ICacheService {
  private readonly logger: ILogger

  constructor(logger: ILogger) {
    this.logger = logger
    this.logger.debug("Null cache service initialized - no caching will be performed")
  }

  async get<T>(_key: string): Promise<T | null> {
    return null
  }

  async set<T>(_key: string, _value: T, _ttl?: number): Promise<void> {
    // No-op
  }

  async del(_key: string): Promise<void> {
    // No-op
  }

  async exists(_key: string): Promise<boolean> {
    return false
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return keys.map(() => null)
  }

  async mset<T>(_keyValuePairs: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    // No-op
  }

  async invalidatePattern(_pattern: string): Promise<void> {
    // No-op
  }

  async flushAll(): Promise<void> {
    // No-op
  }

  async ping(): Promise<boolean> {
    return true
  }

  async disconnect(): Promise<void> {
    // No-op
  }
}
