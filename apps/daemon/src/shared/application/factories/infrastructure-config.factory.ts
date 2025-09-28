/**
 * Infrastructure Configuration Factory
 *
 * Handles creation and configuration of core infrastructure components
 * like database clients and loggers with proper environment setup.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { DatabaseLogger } from "@repo/database/client"
import Logger from "@/shared/utils/logger"
import { DatabaseClient } from "@/database/client"
import { createCryptoService, type ICryptoService } from "@repo/crypto"
import {
  createCacheService,
  getCacheConfigFromEnv,
  type ICacheService,
} from "@/shared/infrastructure/caching"

export interface InfrastructureComponents {
  database: DatabaseClient
  logger: ILogger
  crypto: ICryptoService
  cache: ICacheService
}

/**
 * Creates core infrastructure components with standardized configuration
 *
 * @returns Configured database client, logger instance, and crypto service
 */
export function createInfrastructureComponents(): InfrastructureComponents {
  const database = new DatabaseClient()
  const logger = new Logger()

  // Configure connection pooling (lazy initialization)
  database.configureConnectionPool(logger as DatabaseLogger, {
    maxConnections: Number(process.env.DB_MAX_CONNECTIONS) || 10,
    minConnections: Number(process.env.DB_MIN_CONNECTIONS) || 2,
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT) || 30000,
    idleTimeout: Number(process.env.DB_IDLE_TIMEOUT) || 300000,
    healthCheckInterval: Number(process.env.DB_HEALTH_CHECK_INTERVAL) || 60000,
    maxRetries: Number(process.env.DB_MAX_RETRIES) || 3,
  })

  // In test environment, provide a fallback encryption key if not provided
  if (process.env.NODE_ENV === "test" && !process.env.ENCRYPTION_KEY) {
    // Use a test-specific encryption key (32-byte base64 encoded)
    process.env.ENCRYPTION_KEY = "UeiKre+QpJAdqs8HECeQsuhJGOEatW+gu/t0pXPE5ns="
  }

  // Require encryption key in all environments
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY environment variable is required")
  }
  const crypto = createCryptoService()

  // Create cache service
  const cacheConfig = getCacheConfigFromEnv()
  const cache = createCacheService(cacheConfig, logger)

  return {
    database,
    logger,
    crypto,
    cache,
  }
}
