/**
 * System UUID Service Implementation
 *
 * Production implementation that uses crypto for secure random ID generation.
 */

import { randomBytes, randomUUID } from "crypto"
import type { IClock } from "../time/clock.interface"
import type { IUuidService } from "./uuid.interface"

export class SystemUuidService implements IUuidService {
  constructor(private readonly clock: IClock) {}

  generateMessageId(): string {
    const timestamp = this.clock.timestamp().toString(36)
    const random = randomBytes(8).toString("hex")
    return `msg_${timestamp}_${random}`
  }

  generateCorrelationId(): string {
    const timestamp = this.clock.timestamp().toString(36)
    const random = randomBytes(6).toString("hex")
    return `corr_${timestamp}_${random}`
  }

  generateUuid(): string {
    return randomUUID()
  }

  generateShortId(): string {
    return randomBytes(4).toString("hex")
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
}
