/**
 * Query Bus Implementation
 *
 * Dispatches queries to their registered handlers with caching support.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IQuery, IQueryHandler, IQueryBus } from "./command.types"
import type { CacheEntry } from "@/shared/infrastructure/caching/cache.types"

/**
 * Query Bus
 *
 * Central dispatcher for read operations (queries) with optional caching.
 */
export class QueryBus implements IQueryBus {
  private readonly handlers = new Map<string, IQueryHandler<IQuery, unknown>>()
  private readonly cache = new Map<string, CacheEntry>()

  /** Default cache TTL in milliseconds (5 minutes) */
  private readonly defaultCacheTtl = 5 * 60 * 1000

  constructor(private readonly logger: ILogger) {
    // Start cache cleanup interval
    this.startCacheCleanup()
  }

  /**
   * Execute a query through its registered handler
   */
  async execute<TResult>(query: IQuery): Promise<TResult> {
    const startTime = Date.now()
    const queryType = query.constructor.name

    try {
      this.logger.debug(`Executing query: ${queryType}`, {
        queryId: query.queryId,
        queryType,
        timestamp: query.timestamp,
      })

      // Check cache first
      const cacheKey = this.getCacheKey(query)
      const cached = this.getFromCache<TResult>(cacheKey)
      if (cached !== null) {
        const executionTime = Date.now() - startTime

        this.logger.debug(`Query served from cache: ${queryType}`, {
          queryId: query.queryId,
          queryType,
          executionTime,
          cached: true,
        })

        return cached
      }

      // Find handler for this query type
      const handler = this.handlers.get(queryType)
      if (!handler) {
        throw new Error(`No handler registered for query type: ${queryType}`)
      }

      // Validate query if handler supports validation
      if (handler.validate) {
        const isValid = await handler.validate(query)
        if (!isValid) {
          throw new Error(`Query validation failed for: ${queryType}`)
        }
      }

      // Execute the query - we know the handler exists and is properly typed
      const result = await handler.handle(query)
      const executionTime = Date.now() - startTime

      // Cache the result if it's cacheable
      if (this.isCacheable(query)) {
        this.setCache(cacheKey, result, this.getCacheTtl(query))
      }

      this.logger.debug(`Query executed successfully: ${queryType}`, {
        queryId: query.queryId,
        queryType,
        executionTime,
        cached: false,
      })

      return result as TResult
    } catch (error) {
      const executionTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.logger.error(`Query execution failed: ${queryType}`, {
        queryId: query.queryId,
        queryType,
        executionTime,
        error: errorMessage,
      })

      throw new Error(`Query execution failed: ${errorMessage}`)
    }
  }

  /**
   * Register a query handler
   */
  register<TQuery extends IQuery, TResult>(handler: IQueryHandler<TQuery, TResult>): void {
    const queryType = handler.getQueryType()

    if (this.handlers.has(queryType)) {
      throw new Error(`Handler already registered for query type: ${queryType}`)
    }

    this.handlers.set(queryType, handler)

    this.logger.debug(`Registered query handler: ${queryType}`, {
      queryType,
      handlerName: handler.constructor.name,
    })
  }

  /**
   * Unregister a query handler
   */
  unregister(queryType: string): void {
    if (this.handlers.delete(queryType)) {
      this.logger.debug(`Unregistered query handler: ${queryType}`)
    }
  }

  /**
   * Clear query cache
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      // Clear cache entries matching pattern
      const regex = new RegExp(pattern)
      let clearedCount = 0

      for (const [key] of this.cache) {
        if (regex.test(key)) {
          this.cache.delete(key)
          clearedCount++
        }
      }

      this.logger.debug(`Cleared ${clearedCount} cache entries matching pattern: ${pattern}`)
    } else {
      // Clear all cache
      const size = this.cache.size
      this.cache.clear()
      this.logger.debug(`Cleared all ${size} cache entries`)
    }
  }

  /**
   * Get cache key for a query
   */
  private getCacheKey(query: IQuery): string {
    const queryType = query.constructor.name
    // Create deterministic cache key from query properties
    const queryData = JSON.stringify(query, Object.keys(query).sort())
    return `${queryType}:${this.hashString(queryData)}`
  }

  /**
   * Get data from cache if valid
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (!cached) {
      return null
    }

    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }

    return cached.data as T
  }

  /**
   * Set data in cache
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  /**
   * Check if query is cacheable
   */
  private isCacheable(query: IQuery): boolean {
    // For now, cache all queries unless explicitly disabled
    return !(query as IQuery & { disableCache?: boolean }).disableCache
  }

  /**
   * Get cache TTL for query
   */
  private getCacheTtl(query: IQuery): number {
    return (query as IQuery & { cacheTtl?: number }).cacheTtl || this.defaultCacheTtl
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(
      () => {
        this.cleanupExpiredCache()
      },
      10 * 60 * 1000,
    ) // Every 10 minutes
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`)
    }
  }

  /**
   * Get all registered query types
   */
  getRegisteredQueries(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Check if a query type has a registered handler
   */
  hasHandler(queryType: string): boolean {
    return this.handlers.has(queryType)
  }

  /**
   * Get query bus statistics
   */
  getStats(): {
    registeredHandlers: number
    handlerTypes: string[]
    cacheSize: number
    cacheHitRate?: number
  } {
    return {
      registeredHandlers: this.handlers.size,
      handlerTypes: Array.from(this.handlers.keys()),
      cacheSize: this.cache.size,
    }
  }
}
