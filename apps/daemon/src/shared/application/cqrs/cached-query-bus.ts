/**
 * Cached Query Bus
 *
 * Wraps the query bus with caching capabilities using Garnet.
 * Automatically caches query results and invalidates based on patterns.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { ICacheService } from "@/shared/infrastructure/caching"
import type { IQuery, IQueryBus, IQueryHandler } from "./command.types"
import { QueryBus } from "./query-bus"

export interface CacheOptions {
  ttl?: number
  keyPattern?: string
  invalidateOn?: string[]
}

export interface CachedQuery extends IQuery {
  cacheOptions?: CacheOptions
}

/**
 * Query bus with automatic caching support
 */
export class CachedQueryBus implements IQueryBus {
  private readonly queryBus: QueryBus
  private readonly cache: ICacheService
  private readonly logger: ILogger

  constructor(cache: ICacheService, logger: ILogger) {
    this.queryBus = new QueryBus(logger)
    this.cache = cache
    this.logger = logger
  }

  /**
   * Execute query with caching support
   */
  async execute<TResult>(query: IQuery): Promise<TResult> {
    const cachedQuery = query as CachedQuery
    const cacheKey = this.generateCacheKey(cachedQuery)
    const cacheOptions = cachedQuery.cacheOptions

    // Try to get from cache first
    if (cacheOptions && cacheKey) {
      try {
        const cachedResult = await this.cache.get<TResult>(cacheKey)
        if (cachedResult !== null) {
          this.logger.debug("Query result served from cache", {
            queryType: query.constructor.name,
            cacheKey,
          })
          return cachedResult
        }
      } catch (error) {
        this.logger.warn("Cache read failed, falling back to handler", {
          queryType: query.constructor.name,
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Execute query via handler
    const result = await this.queryBus.execute<TResult>(query)

    // Cache the result if caching is configured
    if (cacheOptions && cacheKey && result) {
      try {
        await this.cache.set(cacheKey, result, cacheOptions.ttl)
        this.logger.debug("Query result cached", {
          queryType: query.constructor.name,
          cacheKey,
          ttl: cacheOptions.ttl,
        })
      } catch (error) {
        this.logger.warn("Failed to cache query result", {
          queryType: query.constructor.name,
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return result
  }

  /**
   * Register a query handler
   */
  register<TQuery extends IQuery, TResult>(handler: IQueryHandler<TQuery, TResult>): void {
    this.queryBus.register(handler)
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      await this.cache.invalidatePattern(pattern)
      this.logger.debug("Cache pattern invalidated", { pattern })
    } catch (error) {
      this.logger.error("Failed to invalidate cache pattern", {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Invalidate specific cache key
   */
  async invalidateKey(key: string): Promise<void> {
    try {
      await this.cache.del(key)
      this.logger.debug("Cache key invalidated", { key })
    } catch (error) {
      this.logger.error("Failed to invalidate cache key", {
        key,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(query: CachedQuery): string | null {
    if (!query.cacheOptions) {
      return null
    }

    const keyPattern = query.cacheOptions.keyPattern
    if (keyPattern) {
      // Use custom key pattern if provided
      return this.interpolateKeyPattern(keyPattern, query)
    }

    // Generate default key from query type and properties
    const baseKey = `query:${query.constructor.name}`
    const queryProps = Object.entries(query)
      .filter(([key]) => key !== "queryId" && key !== "timestamp" && key !== "cacheOptions")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${this.serializeValue(value)}`)
      .join(":")

    return queryProps ? `${baseKey}:${queryProps}` : baseKey
  }

  /**
   * Interpolate key pattern with query values
   */
  private interpolateKeyPattern(pattern: string, query: CachedQuery): string {
    return pattern.replace(/\{(\w+)\}/g, (match, key) => {
      const value = (query as unknown as Record<string, unknown>)[key]
      return value !== undefined ? this.serializeValue(value) : match
    })
  }

  /**
   * Serialize value for cache key
   */
  private serializeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return "null"
    }
    if (typeof value === "object") {
      return JSON.stringify(value)
    }
    return String(value)
  }
}

/**
 * Cache-aware query type helpers
 */
export function createCachedQuery<T extends IQuery>(
  query: T,
  cacheOptions: CacheOptions,
): T & CachedQuery {
  return {
    ...query,
    cacheOptions,
  }
}

/**
 * Common cache key patterns
 */
export const CacheKeyPatterns = {
  PLAYER_STATS: "player:stats:{playerId}",
  SERVER_STATUS: "server:status:{serverId}",
  WEAPON_STATS: "weapon:stats:{weaponId}",
  MATCH_RESULTS: "match:results:{matchId}",
  RANKING_DATA: "ranking:{gameType}:{period}",
} as const
