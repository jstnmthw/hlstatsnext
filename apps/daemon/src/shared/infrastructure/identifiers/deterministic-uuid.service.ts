/**
 * Deterministic UUID Service Implementation
 *
 * Test implementation that generates predictable IDs for testing.
 */

import type { IUuidService } from "./uuid.interface"
import type { IClock } from "../time/clock.interface"

export class DeterministicUuidService implements IUuidService {
  private messageIdCounter = 0
  private correlationIdCounter = 0
  private uuidCounter = 0
  private shortIdCounter = 0

  constructor(private readonly clock: IClock) {}

  generateMessageId(): string {
    const timestamp = this.clock.timestamp().toString(36)
    const sequence = (++this.messageIdCounter).toString(16).padStart(16, "0")
    return `msg_${timestamp}_${sequence}`
  }

  generateCorrelationId(): string {
    const timestamp = this.clock.timestamp().toString(36)
    const sequence = (++this.correlationIdCounter).toString(16).padStart(12, "0")
    return `corr_${timestamp}_${sequence}`
  }

  generateUuid(): string {
    const counter = (++this.uuidCounter).toString(16).padStart(8, "0")
    return `00000000-0000-4000-8000-${counter}00000000`
  }

  generateShortId(): string {
    return (++this.shortIdCounter).toString(16).padStart(8, "0")
  }

  isValidMessageId(messageId: string): boolean {
    return /^msg_[a-z0-9]{6,12}_[a-f0-9]{16}$/.test(messageId)
  }

  isValidCorrelationId(correlationId: string): boolean {
    return /^corr_[a-z0-9]+_[a-f0-9]{12}$/.test(correlationId)
  }

  extractTimestampFromMessageId(messageId: string): number | null {
    const match = messageId.match(/^msg_([a-z0-9]{6,12})_[a-f0-9]{16}$/)
    if (!match || !match[1]) return null

    try {
      const timestamp = parseInt(match[1], 36)
      // Validate that the timestamp is a reasonable value
      if (
        !Number.isFinite(timestamp) ||
        timestamp < 0 ||
        timestamp > this.clock.timestamp() + 365 * 24 * 60 * 60 * 1000
      ) {
        return null
      }
      return timestamp
    } catch {
      return null
    }
  }

  /**
   * Reset all counters (useful for tests)
   */
  reset(): void {
    this.messageIdCounter = 0
    this.correlationIdCounter = 0
    this.uuidCounter = 0
    this.shortIdCounter = 0
  }

  /**
   * Set specific counter values (useful for tests)
   */
  setCounters(counters: {
    messageId?: number
    correlationId?: number
    uuid?: number
    shortId?: number
  }): void {
    if (counters.messageId !== undefined) this.messageIdCounter = counters.messageId
    if (counters.correlationId !== undefined) this.correlationIdCounter = counters.correlationId
    if (counters.uuid !== undefined) this.uuidCounter = counters.uuid
    if (counters.shortId !== undefined) this.shortIdCounter = counters.shortId
  }
}
