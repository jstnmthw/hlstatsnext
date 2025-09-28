/**
 * Cache entry interface
 */
export interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
  ttl: number
}
