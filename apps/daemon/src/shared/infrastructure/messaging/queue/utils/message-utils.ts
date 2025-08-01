/**
 * Queue Utilities
 *
 * Utility functions for message ID generation, correlation IDs, and other
 * queue-related helper functions.
 */

import { randomBytes } from "crypto"

/**
 * Generates a unique message ID using timestamp and random bytes
 */
export function generateMessageId(): string {
  const timestamp = Date.now().toString(36)
  const random = randomBytes(8).toString("hex")
  return `msg_${timestamp}_${random}`
}

/**
 * Generates a correlation ID for distributed tracing
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36)
  const random = randomBytes(6).toString("hex")
  return `corr_${timestamp}_${random}`
}

/**
 * Validates a message ID format
 */
export function isValidMessageId(messageId: string): boolean {
  return /^msg_[a-z0-9]{6,12}_[a-f0-9]{16}$/.test(messageId)
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
  const match = messageId.match(/^msg_([a-z0-9]{6,12})_[a-f0-9]{16}$/)
  if (!match || !match[1]) return null

  try {
    const timestamp = parseInt(match[1], 36)
    // Validate that the timestamp is a reasonable value
    if (
      !Number.isFinite(timestamp) ||
      timestamp < 0 ||
      timestamp > Date.now() + 365 * 24 * 60 * 60 * 1000
    ) {
      return null
    }
    return timestamp
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
  let result = key.toLowerCase()

  // First, replace all non-alphanumeric chars except . and * with dots
  result = result.replace(/[^a-z0-9.*#]/g, ".")

  // Handle # specially: replace with . unless it's preceded by a dot (wildcard)
  result = result.replace(/([^.])#/g, "$1.")

  // Clean up multiple dots and leading/trailing dots
  result = result.replace(/\.+/g, ".")
  result = result.replace(/^\.+|\.+$/g, "")

  return result
}

/**
 * Creates a retry delay using exponential backoff
 */
export function calculateRetryDelay(
  retryCount: number,
  baseDelay = 1000,
  maxDelay = 30000,
): number {
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
  if (bytes === 0) return "0 B"

  const isNegative = bytes < 0
  const absBytes = Math.abs(bytes)

  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"]
  const i = Math.min(Math.floor(Math.log(absBytes) / Math.log(k)), sizes.length - 1)

  const formatted = `${parseFloat((absBytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  return isNegative ? `-${formatted}` : formatted
}

/**
 * Formats duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return `${ms}ms`
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 7200000) return `${(ms / 60000).toFixed(1)}m` // Show minutes up to 2 hours
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
      error: "Failed to serialize object",
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Safely parses JSON with error handling
 */
export function safeJsonParse<T = unknown>(
  json: string,
): { success: true; data: T } | { success: false; error: string } {
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
