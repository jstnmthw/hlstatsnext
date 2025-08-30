/**
 * UUID Service Interface
 *
 * Provides a testable abstraction for UUID/ID generation.
 * This allows us to control ID generation in tests for deterministic behavior.
 */

export interface IUuidService {
  /**
   * Generate a unique message ID
   */
  generateMessageId(): string

  /**
   * Generate a correlation ID for distributed tracing
   */
  generateCorrelationId(): string

  /**
   * Generate a generic UUID (v4)
   */
  generateUuid(): string

  /**
   * Generate a short ID (for non-critical uses)
   */
  generateShortId(): string

  /**
   * Validate a message ID format
   */
  isValidMessageId(messageId: string): boolean

  /**
   * Validate a correlation ID format
   */
  isValidCorrelationId(correlationId: string): boolean

  /**
   * Extract timestamp from message ID (if applicable)
   */
  extractTimestampFromMessageId(messageId: string): number | null
}
