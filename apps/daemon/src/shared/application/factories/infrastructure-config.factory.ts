/**
 * Infrastructure Configuration Factory
 *
 * Handles creation and configuration of core infrastructure components
 * like database clients and loggers with proper environment setup.
 */

import { DatabaseClient } from "@/database/client"
import Logger from "@/shared/utils/logger"
import type { ILogger } from "@/shared/utils/logger.types"
import { createCryptoService, type ICryptoService } from "@repo/crypto"

export interface InfrastructureComponents {
  database: DatabaseClient
  logger: ILogger
  crypto: ICryptoService
}

/**
 * Creates core infrastructure components with standardized configuration
 *
 * @returns Configured database client, logger instance, and crypto service
 */
export function createInfrastructureComponents(): InfrastructureComponents {
  const database = new DatabaseClient()
  const logger = new Logger()

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

  return {
    database,
    logger,
    crypto,
  }
}
