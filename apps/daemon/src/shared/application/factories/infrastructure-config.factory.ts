/**
 * Infrastructure Configuration Factory
 *
 * Handles creation and configuration of core infrastructure components
 * like database clients and loggers with proper environment setup.
 */

import { DatabaseClient } from "@/database/client"
import {
  createCacheService,
  getCacheConfigFromEnv,
  type ICacheService,
} from "@/shared/infrastructure/caching"
import Logger from "@/shared/utils/logger"
import type { ILogger } from "@/shared/utils/logger.types"
import { createCryptoService, type ICryptoService } from "@repo/crypto"
import { PrometheusMetricsExporter, createPrismaWithMetrics } from "@repo/observability"

export interface InfrastructureComponents {
  database: DatabaseClient
  logger: ILogger
  crypto: ICryptoService
  cache: ICacheService
  metrics: PrometheusMetricsExporter
}

/**
 * Creates core infrastructure components with standardized configuration
 *
 * @returns Configured database client, logger instance, crypto service, cache, and metrics
 */
export function createInfrastructureComponents(): InfrastructureComponents {
  const database = new DatabaseClient()
  const logger = new Logger()

  // Create metrics exporter
  const metrics = new PrometheusMetricsExporter(logger)

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

  // Create Prisma client with metrics extension using factory pattern
  // This returns a properly-typed extended client without unsafe casts
  // Guard: database.prisma is undefined when DATABASE_URL is not set (e.g. CI unit tests)
  if (database.prisma) {
    const prismaWithMetrics = createPrismaWithMetrics(database.prisma, metrics, logger, {
      logSlowQueries: process.env.NODE_ENV !== "production",
      slowQueryThresholdMs: 1000,
      logAllQueries: false,
    })

    // Set the extended client on the database wrapper
    // All repositories will now use the metrics-enabled client transparently
    database.setExtendedClient(prismaWithMetrics)
  }

  return {
    database,
    logger,
    crypto,
    cache,
    metrics,
  }
}
