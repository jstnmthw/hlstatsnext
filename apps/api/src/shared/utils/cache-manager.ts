/**
 * Simple in-memory cache manager for API responses
 * In production, this should be replaced with Redis or similar
 */

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
}

class CacheManager {
  private cache = new Map<string, CacheItem<unknown>>()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key)

    if (!item) {
      return null
    }

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    })
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats
   */
  getStats() {
    const now = Date.now()
    let validItems = 0
    let expiredItems = 0

    this.cache.forEach((item) => {
      if (now - item.timestamp > item.ttl) {
        expiredItems++
      } else {
        validItems++
      }
    })

    return {
      totalItems: this.cache.size,
      validItems,
      expiredItems,
      memoryUsage: this.getApproximateSize(),
    }
  }

  /**
   * Clean up expired items
   */
  cleanup(): number {
    const now = Date.now()
    let cleanedCount = 0

    this.cache.forEach((item, key) => {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
        cleanedCount++
      }
    })

    return cleanedCount
  }

  /**
   * Get or set pattern - fetch data if not in cache
   */
  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key)

    if (cached !== null) {
      return cached
    }

    const data = await fetchFn()
    this.set(key, data, ttl)
    return data
  }

  /**
   * Generate cache key for server player queries
   */
  static generateServerPlayerKey(
    serverId: number,
    filters: Record<string, unknown>,
    pagination: Record<string, unknown>,
    orderBy: Record<string, unknown>[],
  ): string {
    return `server_players:${serverId}:${JSON.stringify({ filters, pagination, orderBy })}`
  }

  /**
   * Generate cache key for player counts
   */
  static generateServerPlayerCountKey(serverId: number, filters: Record<string, unknown>): string {
    return `server_player_count:${serverId}:${JSON.stringify(filters)}`
  }

  /**
   * Generate cache key for server info
   */
  static generateServerInfoKey(serverId: number): string {
    return `server_info:${serverId}`
  }

  private getApproximateSize(): number {
    // Rough approximation of memory usage
    return JSON.stringify(Array.from(this.cache.entries())).length
  }
}

// Create singleton instance
export const cacheManager = new CacheManager()

// Export the class for static method access
export { CacheManager }

// Cache TTL constants
export const CACHE_TTL = {
  SERVER_INFO: 2 * 60 * 1000, // 2 minutes
  PLAYER_LIST: 30 * 1000, // 30 seconds
  PLAYER_COUNTS: 15 * 1000, // 15 seconds
  PLAYER_DETAILS: 5 * 60 * 1000, // 5 minutes
  SERVER_LIST: 1 * 60 * 1000, // 1 minute
} as const

// Auto-cleanup every 5 minutes
setInterval(
  () => {
    const cleaned = cacheManager.cleanup()
    if (cleaned > 0) {
      console.log(`Cache cleanup: removed ${cleaned} expired items`)
    }
  },
  5 * 60 * 1000,
)
