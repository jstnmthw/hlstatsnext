/**
 * Queue Utilities
 *
 * Utility functions for message ID generation, correlation IDs, and other
 * queue-related helper functions.
 */

import { randomBytes } from 'crypto'

/**
 * Generates a unique message ID using timestamp and random bytes
 */
export function generateMessageId(): string {
  const timestamp = Date.now().toString(36)
  const random = randomBytes(8).toString('hex')
  return `msg_${timestamp}_${random}`
}

/**
 * Generates a correlation ID for distributed tracing
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36)
  const random = randomBytes(6).toString('hex')
  return `corr_${timestamp}_${random}`
}

/**
 * Validates a message ID format
 */
export function isValidMessageId(messageId: string): boolean {
  return /^msg_[a-z0-9]+_[a-f0-9]{16}$/.test(messageId)
}

/**
 * Validates a correlation ID format
 */
export function isValidCorrelationId(correlationId: string): boolean {
  return /^corr_[a-z0-9]+_[a-f0-9]{12}$/.test(correlationId)
}

/**
 * Extracts timestamp from message ID
 */
export function extractTimestampFromMessageId(messageId: string): number | null {
  const match = messageId.match(/^msg_([a-z0-9]+)_[a-f0-9]{16}$/)
  if (!match || !match[1]) return null
  
  try {
    return parseInt(match[1], 36)
  } catch {
    return null
  }
}

/**
 * Calculates message age in milliseconds
 */
export function calculateMessageAge(messageId: string): number | null {
  const timestamp = extractTimestampFromMessageId(messageId)
  if (!timestamp) return null
  
  return Date.now() - timestamp
}

/**
 * Sanitizes routing key to ensure valid format
 */
export function sanitizeRoutingKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9.*#]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/, '')
}

/**
 * Creates a retry delay using exponential backoff
 */
export function calculateRetryDelay(retryCount: number, baseDelay = 1000, maxDelay = 30000): number {
  const delay = baseDelay * Math.pow(2, retryCount)
  return Math.min(delay, maxDelay)
}

/**
 * Adds jitter to a delay value to prevent thundering herd
 */
export function addJitter(delay: number, jitterFactor = 0.1): number {
  const jitter = delay * jitterFactor * Math.random()
  return Math.floor(delay + jitter)
}

/**
 * Formats bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Formats duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

/**
 * Creates a safe JSON string with error handling
 */
export function safeJsonStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj)
  } catch (error) {
    return JSON.stringify({
      error: 'Failed to serialize object',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Safely parses JSON with error handling
 */
export function safeJsonParse<T = unknown>(json: string): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(json) as T
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}