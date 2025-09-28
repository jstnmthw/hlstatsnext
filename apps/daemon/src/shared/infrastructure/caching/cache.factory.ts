/**
 * Cache Factory
 *
 * Creates and configures cache service instances based on environment
 * configuration with proper fallback strategies.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import { GarnetCacheService, type CacheConfig, type ICacheService } from "./garnet-cache.service"
import { NullCacheService } from "./null-cache.service"

export interface CacheFactoryConfig {
  enabled: boolean
  host: string
  port: number
  password?: string
  keyPrefix: string
  defaultTtl: number
  retryDelayOnFailover: number
  maxRetriesPerRequest: number
}

/**
 * Create cache service based on configuration
 */
export function createCacheService(config: CacheFactoryConfig, logger: ILogger): ICacheService {
  if (!config.enabled) {
    logger.info("Cache service disabled - using null cache")
    return new NullCacheService(logger)
  }

  const cacheConfig: CacheConfig = {
    host: config.host,
    port: config.port,
    password: config.password,
    keyPrefix: config.keyPrefix,
    defaultTtl: config.defaultTtl,
    retryDelayOnFailover: config.retryDelayOnFailover,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
  }

  return new GarnetCacheService(cacheConfig, logger)
}

/**
 * Get cache configuration from environment variables
 */
export function getCacheConfigFromEnv(): CacheFactoryConfig {
  return {
    enabled: process.env.CACHE_ENABLED?.toLowerCase() === "true",
    host: process.env.CACHE_HOST || "localhost",
    port: Number(process.env.CACHE_PORT) || 6379,
    password: process.env.CACHE_PASSWORD,
    keyPrefix: process.env.CACHE_KEY_PREFIX || "hlstats:",
    defaultTtl: Number(process.env.CACHE_DEFAULT_TTL) || 3600, // 1 hour
    retryDelayOnFailover: Number(process.env.CACHE_RETRY_DELAY) || 100,
    maxRetriesPerRequest: Number(process.env.CACHE_MAX_RETRIES) || 3,
  }
}
