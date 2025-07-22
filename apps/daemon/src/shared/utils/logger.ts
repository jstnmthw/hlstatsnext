/**
 * Shared Logger Utilities
 *
 * Re-exports the existing logger while maintaining the shared interface.
 */

import Logger from "@/utils/logger"
import type { ILogger } from "@/utils/logger.types"

// Create logger factory function for dependency injection
export function createLogger(): ILogger {
  return new Logger()
}
