/**
 * Shared Logger Utilities
 * 
 * Re-exports the existing logger while maintaining the shared interface.
 */

import { logger as originalLogger } from '@/utils/logger'
export type { ILogger } from '@/utils/logger.types'

export const logger = originalLogger

// Create logger factory function for dependency injection
export function createLogger(): import('@/utils/logger.types').ILogger {
  return originalLogger
}