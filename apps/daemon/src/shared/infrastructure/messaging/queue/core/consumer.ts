/**
 * Event Consumer Implementation
 *
 * Lifecycle state machine for RabbitMQ consumption with multi-queue support.
 * Delegates retry/DLQ decisions to MessageRetryOrchestrator, metrics
 * bookkeeping to ConsumerMetricsCollector, and message parsing/validation to
 * message-validator helpers.
 */

import { formatDuration } from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import { ConsumerMetricsCollector } from "./consumer-metrics-collector"
import { MessageRetryOrchestrator } from "./message-retry-orchestrator"
import { defaultMessageValidator, parseMessage } from "./message-validator"
import type {
  ConsumeMessage,
  ConsumerStats,
  IEventConsumer,
  IQueueClient,
  MessageValidator,
  QueueChannel,
} from "./types"
import { QueueConsumeError } from "./types"

export { defaultMessageValidator } from "./message-validator"

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

  private readonly metrics: ConsumerMetricsCollector
  private readonly retryOrchestrator: MessageRetryOrchestrator

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

  constructor(
    private readonly client: IQueueClient,
    private readonly processor: IEventProcessor,
    private readonly logger: ILogger,
    private readonly config: ConsumerConfig = defaultConsumerConfig,
    private readonly messageValidator: MessageValidator = defaultMessageValidator,
  ) {
    this.metrics = new ConsumerMetricsCollector(this.logger)
    this.retryOrchestrator = new MessageRetryOrchestrator(
      {
        maxRetries: this.config.maxRetries,
        retryDelay: this.config.retryDelay,
        maxRetryDelay: this.config.maxRetryDelay,
      },
      this.logger,
      this.metrics,
    )
  }

  async start(): Promise<void> {
    if (this.isConsuming) {
      throw new QueueConsumeError("Consumer is already running")
    }

    try {
      this.metrics.resetForStart(this.config.queues)

      // Subscribe BEFORE starting consumeQueue so a reconnect during initial
      // subscribe (rare but possible) won't be missed.
      this.client.on("connected", this.onClientConnected)

      await Promise.all(this.config.queues.map((queueName) => this.consumeQueue(queueName)))

      this.isConsuming = true
      this.metrics.setConsuming(true)
      this.isPaused = false

      this.logger.info(
        `Event consumer started successfully for queues: ${this.config.queues.join(", ")} with concurrency: ${this.config.concurrency}`,
      )

      if (this.config.logMetrics !== false) {
        const interval = this.config.metricsInterval ?? 30000
        this.metrics.startPeriodicLogging(interval)
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
      this.metrics.stopPeriodicLogging()

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
      // A timer that fires after this point would publish to a dead channel.
      const cancelled = this.retryOrchestrator.cancelPending()
      if (cancelled > 0) {
        this.logger.debug(`Cancelling ${cancelled} pending retry timer(s)`)
      }

      this.channels.clear()
      this.consumerTags = []
      this.isConsuming = false
      this.metrics.setConsuming(false)

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
    return this.metrics.getStats()
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

    this.metrics.setQueueDepth(total)
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

    this.metrics.recordReceived(queueName)

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
      const parseResult = parseMessage(msg)
      if (!parseResult.success) {
        this.logger.error(
          `Failed to parse message from ${queueName}: ${parseResult.error} (contentLength: ${msg.content.length})`,
        )

        await this.retryOrchestrator.reject(msg, channel, "Invalid message format")
        this.metrics.recordValidationError(queueName)
        return
      }

      const message = parseResult.data
      messageId = message.id

      try {
        await this.messageValidator(message)
      } catch (validationError) {
        this.metrics.recordValidationError(queueName)
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

      await this.processor.processEvent(message.payload)

      await channel.ack(msg)
      const processingTime = Date.now() - startTime
      this.metrics.recordProcessed(queueName, processingTime)

      this.logger.debug(
        `Message ${messageId} (${message.payload.eventType}) processed successfully in ${formatDuration(processingTime)}`,
      )
    } catch (error) {
      const processingTime = Date.now() - startTime

      this.logger.error(
        `Error processing message ${messageId} from ${queueName} in ${formatDuration(processingTime)}: ${error instanceof Error ? error.message : String(error)}`,
      )

      this.metrics.recordQueueError(queueName)

      await this.retryOrchestrator.handleFailure(msg, channel, error as Error)
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
