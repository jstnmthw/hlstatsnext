/**
 * Owns the retry-vs-DLQ decision, exponential-backoff delay scheduling, and
 * deferred republish for failed messages. Tracks pending retry timers so the
 * consumer's stop() can cancel them — a timer that fires against a closed
 * channel either throws (swallowed) or, worse, races a half-open shutdown.
 *
 * Republish-then-ack ordering is preserved: a nack-then-republish design
 * would dead-letter the original AND queue a copy on every retry, producing
 * N+1 DLQ entries per persistently-failing event.
 */

import {
  addJitter,
  calculateRetryDelay,
} from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import type { ILogger } from "@/shared/utils/logger.types"
import type { ConsumerMetricsCollector } from "./consumer-metrics-collector"
import { parseMessage } from "./message-validator"
import type { ConsumeMessage, EventMessage, QueueChannel } from "./types"

export interface RetryConfig {
  readonly maxRetries: number
  readonly retryDelay: number
  readonly maxRetryDelay: number
}

export class MessageRetryOrchestrator {
  private readonly pendingTimers = new Set<NodeJS.Timeout>()

  constructor(
    private readonly config: RetryConfig,
    private readonly logger: ILogger,
    private readonly metrics: ConsumerMetricsCollector,
  ) {}

  /**
   * Handle a processing failure: either schedule a deferred retry or
   * dead-letter the message. Idempotent against parse failure (rejects).
   */
  async handleFailure(msg: ConsumeMessage, channel: QueueChannel, error: Error): Promise<void> {
    try {
      const parseResult = parseMessage(msg)
      if (!parseResult.success) {
        await this.reject(msg, channel, "Unparseable message with processing error")
        return
      }

      const message = parseResult.data
      const retryCount = message.metadata.routing.retryCount

      if (retryCount < this.config.maxRetries) {
        this.scheduleRetry(msg, channel, message, retryCount)
      } else {
        this.logger.error(
          `Message ${message.id} exceeded retry limit (${retryCount}/${this.config.maxRetries}), sending to DLQ`,
        )
        await channel.nack(msg, false, false)
        this.metrics.recordRejected()
      }
    } catch (handlingError) {
      this.logger.error(
        `Error in error handling - original: ${error.message}, handling error: ${handlingError instanceof Error ? handlingError.message : String(handlingError)}`,
      )
      await this.reject(msg, channel, "Error in error handling")
    }
  }

  /**
   * Reject a message outright (no retry). Used for unparseable payloads and
   * terminal error-handler failures.
   */
  async reject(msg: ConsumeMessage, channel: QueueChannel, reason: string): Promise<void> {
    this.logger.warn(`Rejecting message: ${reason}`)
    channel.nack(msg, false, false)
    this.metrics.recordRejected()
  }

  /**
   * Cancel every pending retry timer. Called by EventConsumer.stop() before
   * channels are torn down so abandoned timers cannot publish to dead
   * channels.
   */
  cancelPending(): number {
    const count = this.pendingTimers.size
    if (count > 0) {
      for (const timer of this.pendingTimers) clearTimeout(timer)
      this.pendingTimers.clear()
    }
    return count
  }

  get pendingCount(): number {
    return this.pendingTimers.size
  }

  private scheduleRetry(
    msg: ConsumeMessage,
    channel: QueueChannel,
    message: EventMessage,
    retryCount: number,
  ): void {
    const baseDelay = calculateRetryDelay(
      retryCount,
      this.config.retryDelay,
      this.config.maxRetryDelay,
    )
    const delay = addJitter(baseDelay)

    this.logger.info(
      `Retrying message ${message.id} (attempt ${retryCount + 1}/${this.config.maxRetries}) in ${delay}ms`,
    )

    const timer: NodeJS.Timeout = setTimeout(async () => {
      this.pendingTimers.delete(timer)
      try {
        await this.republish(message, channel)
        try {
          await channel.ack(msg)
          this.metrics.recordAckedRetry()
        } catch (ackError) {
          // Channel likely closed in the gap between republish and ack; the
          // broker will redeliver the original on the next consume. One
          // duplicate is the lesser evil vs. losing the message.
          this.logger.warn(
            `Ack after republish failed for ${message.id}: ${ackError instanceof Error ? ackError.message : String(ackError)}`,
          )
        }
      } catch (republishError) {
        // Leave the original un-acked; broker redelivers and retryCount
        // stays the same so we'll try again.
        this.logger.error(
          `Failed to republish message ${message.id} for retry; leaving un-acked for broker redelivery: ${republishError}`,
        )
      }
    }, delay)
    this.pendingTimers.add(timer)
  }

  private async republish(message: EventMessage, channel: QueueChannel): Promise<void> {
    const updatedMessage: EventMessage = {
      ...message,
      metadata: {
        ...message.metadata,
        routing: {
          ...message.metadata.routing,
          retryCount: message.metadata.routing.retryCount + 1,
        },
      },
    }

    const published = channel.publish(
      "hlstats.events",
      message.metadata.routing.key,
      Buffer.from(JSON.stringify(updatedMessage)),
      {
        persistent: true,
        priority: message.metadata.routing.priority,
        messageId: message.id,
        headers: {
          "x-correlation-id": message.correlationId,
          "x-retry-count": updatedMessage.metadata.routing.retryCount,
        },
      },
    )

    if (!published) {
      throw new Error("Failed to republish message: channel buffer full")
    }
  }
}
