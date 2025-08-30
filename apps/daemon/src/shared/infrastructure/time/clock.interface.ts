/**
 * Clock Interface
 *
 * Provides a testable abstraction for time-related operations.
 * This allows us to control time in tests for deterministic behavior.
 */

export interface IClock {
  /**
   * Get the current date and time
   */
  now(): Date

  /**
   * Get the current timestamp in milliseconds since Unix epoch
   */
  timestamp(): number

  /**
   * Get the current timestamp formatted as ISO string
   */
  isoString(): string

  /**
   * Create a Date object from a timestamp
   */
  fromTimestamp(timestamp: number): Date

  /**
   * Sleep for a given number of milliseconds (useful for testing delays)
   */
  sleep(ms: number): Promise<void>
}
