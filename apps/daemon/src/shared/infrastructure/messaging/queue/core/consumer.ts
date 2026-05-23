/**
 * Event Consumer Implementation
 *
 * Implements event consumption from RabbitMQ with multi-queue support,
 * retry logic with exponential backoff, and dead letter queue handling.
 */

import {
  addJitter,
  calculateRetryDelay,
  formatDuration,
  safeJsonParse,
} from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type {
  ConsumeMessage,
  ConsumerStats,
  EventMessage,
  IEventConsumer,
  IQueueClient,
  MessageValidator,
  QueueChannel,
} from "./types"
import { QueueConsumeError } from "./types"

/**
 * Event processor interface for handling consumed events
 */
export interface IEventProcessor {
  processEvent(event: BaseEvent): Promise<void>
}

/**
 * Consumer configuration
 */
export interface ConsumerConfig {
  readonly maxRetries: number
  readonly retryDelay: number
  readonly maxRetryDelay: number
  readonly concurrency: number
  readonly queues: readonly string[]
  /** Enable periodic metrics logging */
  readonly logMetrics?: boolean
  /** Interval for periodic metrics logging (ms) */
  readonly metricsInterval?: number
}

/**
 * Event consumer for RabbitMQ with comprehensive error handling and retry logic
 */
export class EventConsumer implements IEventConsumer {
  private channels: Map<string, QueueChannel> = new Map()
  private consumerTags: string[] = []
  private isConsuming = false
  private isPaused = false

  /**
   * Bound listener kept as a field so we can subscribe in start() and
   * unsubscribe in stop() without losing the reference. Accumulated listeners
   * on the long-lived client would leak one per start/stop cycle.
   */
  private readonly onClientConnected = (): void => {
    void this.resubscribeAfterReconnect()
  }

  private stats: ConsumerStats = {
    isConsuming: false,
    messagesProcessed: 0,
    messagesAcked: 0,
    messagesNacked: 0,
    messagesRejected: 0,
    averageProcessingTime: 0,
    queueDepth: 0,
  }

  private processingTimes: number[] = []
  private readonly maxProcessingTimesSamples = 1000

  /**
   * Promises for currently-running handleMessage invocations. On shutdown we
   * cancel the consumer tags (so the broker stops delivering) and then await
   * this set with a deadline. Without this, channels close mid-handler and
   * the unacked messages are redelivered + double-processed on next start —
   * none of the writers (chat_message, EventFrag, Action, …) are idempotent.
   */
  private readonly inflight = new Set<Promise<void>>()

  /** Hard cap on shutdown drain wait, so a wedged handler can't block exit. */
  private static readonly DRAIN_TIMEOUT_MS = 5_000

  /**
   * Retry republish timers tracked so stop() can cancel them. Without this,
   * a pending retry fires against either a closed channel (throws, swallowed)
   * or — worse — races a still-open one during connection-close. An
   * abandoned timer is equivalent to dropping the retry, which is acceptable:
   * the broker's TTL + x-max-length still bound the impact.
   */
  private readonly pendingTimers = new Set<NodeJS.Timeout>()

  // Metrics reporting
  private metricsTimer: NodeJS.Timeout | null = null
  private startTime: Date = new Date()
  private eventsReceived = 0
  private validationErrors = 0
  private queueStats: Record<
    string,
    {
      received: number
      processed: number
      errors: number
      lastProcessedAt?: Date
    }
  > = {}

  constructor(
    private readonly client: IQueueClient,
    private readonly processor: IEventProcessor,
    private readonly logger: ILogger,
    private readonly config: ConsumerConfig = defaultConsumerConfig,
    private readonly messageValidator: MessageValidator = defaultMessageValidator,
  ) {}

  async start(): Promise<void> {
    if (this.isConsuming) {
      throw new QueueConsumeError("Consumer is already running")
    }

    try {
      // Initialize metrics state
      this.startTime = new Date()
      this.eventsReceived = 0
      this.validationErrors = 0
      this.queueStats = {}

      for (const queueName of this.config.queues) {
        this.queueStats[queueName] = { received: 0, processed: 0, errors: 0 }
      }

      // Subscribe BEFORE starting consumeQueue so a reconnect during initial
      // subscribe (rare but possible) won't be missed.
      this.client.on("connected", this.onClientConnected)

      // Start consuming from all configured queues
      await Promise.all(this.config.queues.map((queueName) => this.consumeQueue(queueName)))

      this.isConsuming = true
      this.stats.isConsuming = true
      this.isPaused = false

      this.logger.info(
        `Event consumer started successfully for queues: ${this.config.queues.join(", ")} with concurrency: ${this.config.concurrency}`,
      )

      // Start periodic metrics logging if enabled
      if (this.config.logMetrics !== false) {
        const interval = this.config.metricsInterval ?? 30000
        this.metricsTimer = setInterval(() => {
          this.logMetrics()
        }, interval)
      }
    } catch (error) {
      this.logger.error(`Failed to start event consumer: ${error}`)
      throw new QueueConsumeError("Failed to start consumer", error as Error)
    }
  }

  async stop(): Promise<void> {
    if (!this.isConsuming) {
      return
    }

    try {
      // Stop metrics timer
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer)
        this.metricsTimer = null
      }

      // Unsubscribe from reconnect events so the listener doesn't leak across
      // start/stop cycles.
      this.client.off("connected", this.onClientConnected)

      // Phase 1: tell broker to stop delivering NEW messages. In-flight
      // handlers continue to run.
      for (const [queueName, channel] of this.channels) {
        const consumerTag = this.consumerTags.find((tag) => tag.startsWith(queueName))
        if (consumerTag) {
          try {
            await channel.cancel(consumerTag)
            this.logger.debug(`Cancelled consumer tag: ${consumerTag}`)
          } catch (error) {
            // Channel might already be closed
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (
              !errorMessage.includes("Channel closed") &&
              !errorMessage.includes("IllegalOperationError")
            ) {
              this.logger.warn(`Failed to cancel consumer ${consumerTag}: ${error}`)
            }
          }
        }
      }

      // Phase 2: drain in-flight handlers with a bounded wait. Anything still
      // pending after the deadline gets abandoned — the broker will redeliver
      // those unacked messages on reconnect. Handlers are not idempotent at
      // the DB layer, so this can cause stat drift, but losing the ack here
      // is the lesser evil vs. closing the channel mid-write.
      if (this.inflight.size > 0) {
        const pendingCount = this.inflight.size
        this.logger.info(`Draining ${pendingCount} in-flight handler(s) before shutdown`)
        const drained = await drainWithTimeout(
          Array.from(this.inflight),
          EventConsumer.DRAIN_TIMEOUT_MS,
        )
        if (!drained) {
          this.logger.warn(
            `Drain timed out after ${EventConsumer.DRAIN_TIMEOUT_MS}ms with ${this.inflight.size} handler(s) still running; abandoning them`,
          )
        }
      }

      // Cancel any pending retry republish timers before clearing channels.
      // A timer that fires after this point would publish to a dead channel;
      // better to drop the retry than to throw on a closed channel (or worse,
      // push during a half-open shutdown race).
      if (this.pendingTimers.size > 0) {
        this.logger.debug(`Cancelling ${this.pendingTimers.size} pending retry timer(s)`)
        for (const timer of this.pendingTimers) clearTimeout(timer)
        this.pendingTimers.clear()
      }

      // Clear references but don't close channels
      this.channels.clear()
      this.consumerTags = []
      this.isConsuming = false
      this.stats.isConsuming = false

      this.logger.info("Event consumer stopped")
    } catch (error) {
      this.logger.error(`Error stopping consumer: ${error}`)
      throw new QueueConsumeError("Failed to stop consumer", error as Error)
    }
  }

  /**
   * Pause delivery from the broker via `channel.cancel(consumerTag)`. The
   * broker stops delivering until we re-`consume()` on resume. A nack-with-
   * requeue approach would spin at 100% CPU shuffling the prefetched messages
   * back and forth — broker keeps delivering, we keep rejecting.
   */
  async pause(): Promise<void> {
    if (this.isPaused) return
    this.isPaused = true
    for (const [queueName, channel] of this.channels) {
      const consumerTag = this.consumerTags.find((tag) => tag.startsWith(queueName))
      if (!consumerTag) continue
      try {
        await channel.cancel(consumerTag)
      } catch (error) {
        // Channel may already be closing — log but keep going so other queues
        // still get paused.
        this.logger.warn(
          `Failed to cancel consumer for pause on ${queueName}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    this.consumerTags = []
    this.logger.info("Event consumer paused (broker delivery stopped)")
  }

  async resume(): Promise<void> {
    if (!this.isPaused) return
    this.isPaused = false

    // Re-issue consume() for every channel that's still open. We do NOT
    // clear `this.channels` — the channels themselves are fine, only their
    // consumer subscription was cancelled.
    for (const [queueName, channel] of this.channels) {
      try {
        const consumerTag = await channel.consume(
          queueName,
          (msg) => this.dispatch(msg, channel, queueName),
          {
            noAck: false,
            consumerTag: `${queueName}-${process.pid}-${Date.now()}`,
          },
        )
        this.consumerTags.push(consumerTag)
      } catch (error) {
        this.logger.error(
          `Failed to resume consume for ${queueName}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
    this.logger.info("Event consumer resumed")
  }

  getConsumerStats(): ConsumerStats {
    return {
      ...this.stats,
      averageProcessingTime: this.calculateAverageProcessingTime(),
    }
  }

  /**
   * Query the current queue depth (ready message count) across all consumed
   * queues via a passive check on each consumer channel.
   *
   * Updates the cached `queueDepth` stat and returns the aggregate total.
   * Returns 0 when the consumer is not running (no open channels).
   */
  async getQueueDepth(): Promise<number> {
    let total = 0

    for (const [queueName, channel] of this.channels) {
      try {
        const { messageCount } = await channel.checkQueue(queueName)
        total += messageCount
      } catch (error) {
        this.logger.debug(
          `Failed to check depth for queue ${queueName}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    this.stats.queueDepth = total
    return total
  }

  /**
   * After a transparent reconnect, the client has cleared its channel cache and
   * created a fresh connection — but our subscriptions live on the dead
   * channels. Drop the stale references and re-issue consume() for every
   * queue. Without this, the daemon keeps publishing but stops consuming
   * forever after the first MQ blip.
   */
  private async resubscribeAfterReconnect(): Promise<void> {
    if (!this.isConsuming) return

    this.logger.warn("RabbitMQ reconnected — re-subscribing consumers")
    this.channels.clear()
    this.consumerTags = []

    try {
      await Promise.all(this.config.queues.map((queueName) => this.consumeQueue(queueName)))
      this.logger.info("Consumer re-subscribed to all queues after reconnect")
    } catch (error) {
      this.logger.error(
        `Failed to re-subscribe consumers after reconnect: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private async consumeQueue(queueName: string): Promise<void> {
    const channel = await this.client.createChannel(`consumer-${queueName}`)
    this.channels.set(queueName, channel)

    // Per-channel prefetch is the actual cap on in-flight messages this
    // channel will hold from the broker — what an operator tuning the
    // `concurrency` knob expects.
    try {
      await channel.prefetch(this.config.concurrency)
    } catch (error) {
      this.logger.warn(
        `Failed to set prefetch=${this.config.concurrency} on ${queueName}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // Invalidate the cached channel when amqplib closes it. The client's
    // `"connected"` event will trigger a fresh consumeQueue() on reconnect.
    channel.on("close", () => {
      if (this.channels.get(queueName) === channel) {
        this.channels.delete(queueName)
      }
    })
    channel.on("error", (...args: unknown[]) => {
      const err = args[0]
      this.logger.error(
        `Consumer channel error for ${queueName}: ${err instanceof Error ? err.message : String(err)}`,
      )
    })

    // Set up consumer with error handling. The async dispatch is shared with
    // resume() — pause() cancels the consumer tag rather than nack-spinning.
    const consumerTag = await channel.consume(
      queueName,
      (msg) => this.dispatch(msg, channel, queueName),
      {
        noAck: false,
        consumerTag: `${queueName}-${process.pid}-${Date.now()}`,
      },
    )

    this.consumerTags.push(consumerTag)
    this.logger.debug(`Started consuming from queue ${queueName} with consumerTag: ${consumerTag}`)
  }

  /**
   * Per-message dispatch shared between initial consume and resume().
   * Increments counters, tracks in-flight, and invokes handleMessage.
   */
  private async dispatch(
    msg: ConsumeMessage | null,
    channel: QueueChannel,
    queueName: string,
  ): Promise<void> {
    if (!msg) {
      this.logger.warn(`Received null message from queue ${queueName}`)
      return
    }

    this.eventsReceived++
    this.queueStats[queueName]!.received++

    // Track in-flight so stop() can drain before tearing down channels.
    const work = this.handleMessage(msg, channel, queueName)
    this.inflight.add(work)
    try {
      await work
    } finally {
      this.inflight.delete(work)
    }
  }

  private async handleMessage(
    msg: ConsumeMessage,
    channel: QueueChannel,
    queueName: string,
  ): Promise<void> {
    const startTime = Date.now()
    let messageId = "unknown"

    try {
      // Parse message
      const parseResult = this.parseMessage(msg)
      if (!parseResult.success) {
        this.logger.error(
          `Failed to parse message from ${queueName}: ${parseResult.error} (contentLength: ${msg.content.length})`,
        )

        await this.rejectMessage(msg, channel, "Invalid message format")
        // Count parse/validation error against metrics
        this.validationErrors++
        this.queueStats[queueName]!.errors++
        return
      }

      const message = parseResult.data
      messageId = message.id

      // Validate message
      try {
        await this.messageValidator(message)
      } catch (validationError) {
        this.validationErrors++
        throw validationError
      }

      this.logger.queue(
        `Event received: ${message.payload.eventType} (Server ID: ${message.metadata.source.serverId})`,
        {
          messageId,
          eventType: message.payload.eventType,
          queueName,
          retryCount: message.metadata.routing.retryCount,
        },
      )

      // Process the event
      await this.processor.processEvent(message.payload)

      // Acknowledge successful processing
      await channel.ack(msg)
      this.stats.messagesAcked++
      this.stats.messagesProcessed++
      this.queueStats[queueName]!.processed++
      this.queueStats[queueName]!.lastProcessedAt = new Date()

      const processingTime = Date.now() - startTime
      this.recordProcessingTime(processingTime)

      this.logger.debug(
        `Message ${messageId} (${message.payload.eventType}) processed successfully in ${formatDuration(processingTime)}`,
      )
    } catch (error) {
      const processingTime = Date.now() - startTime

      this.logger.error(
        `Error processing message ${messageId} from ${queueName} in ${formatDuration(processingTime)}: ${error instanceof Error ? error.message : String(error)}`,
      )

      // Track per-queue errors
      this.queueStats[queueName]!.errors++

      await this.handleProcessingError(msg, channel, error as Error)
    }
  }

  private async handleProcessingError(
    msg: ConsumeMessage,
    channel: QueueChannel,
    error: Error,
  ): Promise<void> {
    try {
      const parseResult = this.parseMessage(msg)
      if (!parseResult.success) {
        await this.rejectMessage(msg, channel, "Unparseable message with processing error")
        return
      }

      const message = parseResult.data
      const retryCount = message.metadata.routing.retryCount

      if (retryCount < this.config.maxRetries) {
        // Republish first, then ack the original. A nack-then-republish
        // design would dead-letter the original AND queue a new copy on
        // every retry — N+1 DLQ entries per persistently-failing event.
        // The retry stays in the live queue (so message TTL applies); the
        // DLQ is reserved for terminal failures only.
        const baseDelay = calculateRetryDelay(
          retryCount,
          this.config.retryDelay,
          this.config.maxRetryDelay,
        )
        const delay = addJitter(baseDelay)

        this.logger.info(
          `Retrying message ${message.id} (attempt ${retryCount + 1}/${this.config.maxRetries}) in ${delay}ms`,
        )

        // Defer the republish so the failing condition (DB hiccup, etc.) has
        // time to clear. Track the timer so stop() can cancel it.
        const timer: NodeJS.Timeout = setTimeout(async () => {
          this.pendingTimers.delete(timer)
          try {
            await this.republishWithRetry(message, channel)
            // Republish accepted — safe to ack the original now. If we ack'd
            // first we'd risk losing the message on a republish failure.
            try {
              await channel.ack(msg)
              this.stats.messagesAcked++
            } catch (ackError) {
              // Channel likely closed in the gap between republish and ack;
              // the broker will redeliver the original on the next consume.
              // Worst case is one duplicate, which is the lesser evil vs.
              // losing the message entirely.
              this.logger.warn(
                `Ack after republish failed for ${message.id}: ${ackError instanceof Error ? ackError.message : String(ackError)}`,
              )
            }
          } catch (republishError) {
            // Republish failed — leave the original un-acked. Broker
            // redelivers it; retryCount stays the same so we'll try again.
            this.logger.error(
              `Failed to republish message ${message.id} for retry; leaving un-acked for broker redelivery: ${republishError}`,
            )
          }
        }, delay)
        this.pendingTimers.add(timer)
      } else {
        // Terminal failure — send to DLQ for human review (or DLQ consumer).
        this.logger.error(
          `Message ${message.id} exceeded retry limit (${retryCount}/${this.config.maxRetries}), sending to DLQ`,
        )

        await channel.nack(msg, false, false)
        this.stats.messagesRejected++
      }
    } catch (handlingError) {
      this.logger.error(
        `Error in error handling - original: ${error.message}, handling error: ${handlingError instanceof Error ? handlingError.message : String(handlingError)}`,
      )

      // Last resort: reject the message
      await this.rejectMessage(msg, channel, "Error in error handling")
    }
  }

  private async republishWithRetry(message: EventMessage, channel: QueueChannel): Promise<void> {
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

  private async rejectMessage(
    msg: ConsumeMessage,
    channel: QueueChannel,
    reason: string,
  ): Promise<void> {
    this.logger.warn(`Rejecting message: ${reason}`)
    channel.nack(msg, false, false)
    this.stats.messagesRejected++
  }

  private parseMessage(
    msg: ConsumeMessage,
  ): { success: true; data: EventMessage } | { success: false; error: string } {
    try {
      const content = msg.content.toString("utf8")
      return safeJsonParse<EventMessage>(content)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time)

    // Keep only the last N samples for rolling average
    if (this.processingTimes.length > this.maxProcessingTimesSamples) {
      this.processingTimes.shift()
    }
  }

  private calculateAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) {
      return 0
    }

    const sum = this.processingTimes.reduce((acc, time) => acc + time, 0)
    return sum / this.processingTimes.length
  }

  /**
   * Periodic metrics logger to mirror Shadow Consumer metrics for real processing
   */
  private logMetrics(): void {
    const uptimeMs = Date.now() - this.startTime.getTime()
    const eventsPerSecond = uptimeMs > 0 ? this.eventsReceived / (uptimeMs / 1000) : 0

    this.logger.info(`Queue Consumer Metrics:`)
    this.logger.info(`  Events Received: ${this.eventsReceived}`)
    this.logger.info(`  Events Processed: ${this.stats.messagesProcessed}`)
    this.logger.info(`  Validation Errors: ${this.validationErrors}`)
    this.logger.info(`  Events/sec: ${eventsPerSecond.toFixed(2)}`)

    // Per-queue stats
    for (const [queueName, q] of Object.entries(this.queueStats)) {
      this.logger.info(
        `  Queue ${queueName}: ${q.received} received, ${q.processed} processed, ${q.errors} errors`,
      )
    }
  }
}

/**
 * Wait for all in-flight handlers to settle, or `timeoutMs` to elapse.
 * Returns true if everything drained, false on timeout.
 */
async function drainWithTimeout(work: Promise<unknown>[], timeoutMs: number): Promise<boolean> {
  if (work.length === 0) return true
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs)
  })
  try {
    const result = await Promise.race([
      Promise.allSettled(work).then(() => "drained" as const),
      timeout,
    ])
    return result === "drained"
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Default consumer configuration
 */
export const defaultConsumerConfig: ConsumerConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  maxRetryDelay: 30000,
  concurrency: 10,
  queues: ["hlstats.events.priority", "hlstats.events.standard", "hlstats.events.bulk"],
  logMetrics: true,
  metricsInterval: 30000,
}

/**
 * Default message validator
 */
export async function defaultMessageValidator(message: EventMessage): Promise<void> {
  if (!message.id) {
    throw new Error("Message missing ID")
  }

  if (!message.payload) {
    throw new Error("Message missing payload")
  }

  if (!message.payload.eventType) {
    throw new Error("Message payload missing eventType")
  }

  if (!message.metadata) {
    throw new Error("Message missing metadata")
  }

  if (typeof message.metadata.source.serverId !== "number") {
    throw new Error("Message metadata missing or invalid serverId")
  }
}
