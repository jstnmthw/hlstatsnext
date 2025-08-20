/**
 * Infrastructure Configuration Factory
 *
 * Handles creation and configuration of core infrastructure components
 * like database clients and loggers with proper environment setup.
 */

import { DatabaseClient } from "@/database/client"
import Logger from "@/shared/utils/logger"
import type { ILogger } from "@/shared/utils/logger.types"

export interface InfrastructureComponents {
  database: DatabaseClient
  logger: ILogger
}

/**
 * Creates core infrastructure components with standardized configuration
 *
 * @returns Configured database client and logger instance
 */
export function createInfrastructureComponents(): InfrastructureComponents {
  const database = new DatabaseClient()
  const logger = new Logger()

  return {
    database,
    logger,
  }
}
