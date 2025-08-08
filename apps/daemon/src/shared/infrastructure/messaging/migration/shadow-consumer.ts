/**
 * Shadow Consumer for Migration Validation
 *
 * This consumer runs in "shadow mode" during the migration from EventBus to RabbitMQ.
 * It consumes events from RabbitMQ queues but doesn't process them - instead it validates
 * that events are flowing correctly and compares metrics with the EventBus.
 */

import type {
  IQueueClient,
  QueueChannel,
  EventMessage,
} from "@/shared/infrastructure/messaging/queue/core/types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { BaseEvent } from "@/shared/types/events"
import { safeJsonParse } from "@/shared/infrastructure/messaging/queue/utils/message-utils"

export interface ShadowConsumerConfig {
  /** Queues to consume from for validation */
  readonly queues: string[]
  /** How often to log validation metrics (in ms) */
  readonly metricsInterval: number
  /** Whether to log individual events for debugging */
  readonly logEvents: boolean
  /** Whether to log detailed parsing errors */
  readonly logParsingErrors: boolean
  /** Whether to log raw message content on errors */
  readonly logRawMessages: boolean
  /** Maximum number of events to buffer for comparison */
  readonly maxBufferSize: number
}

export interface ShadowConsumerStats {
  readonly eventsReceived: number
  readonly eventsProcessed: number
  readonly validationErrors: number
  readonly queueStats: Record<
    string,
    {
      received: number
      processed: number
      errors: number
      lastProcessedAt?: Date
    }
  >
  readonly startTime: Date
  readonly isRunning: boolean
}

interface MutableShadowConsumerStats {
  eventsReceived: number
  eventsProcessed: number
  validationErrors: number
  queueStats: Record<
    string,
    {
      received: number
      processed: number
      errors: number
      lastProcessedAt?: Date
    }
  >
  startTime: Date
  isRunning: boolean
}

/**
 * Shadow consumer for validating RabbitMQ events during migration
 */
export class ShadowConsumer {
  private channels: Map<string, QueueChannel> = new Map()
  private running = false
  private stats: MutableShadowConsumerStats
  private metricsTimer: NodeJS.Timeout | null = null
  private eventBuffer: Map<string, BaseEvent> = new Map()

  constructor(
    private readonly client: IQueueClient,
    private readonly config: ShadowConsumerConfig,
    private readonly logger: ILogger,
  ) {
    this.stats = {
      eventsReceived: 0,
      eventsProcessed: 0,
      validationErrors: 0,
      queueStats: {},
      startTime: new Date(),
      isRunning: false,
    }

    // Initialize queue stats
    for (const queueName of config.queues) {
      this.stats.queueStats[queueName] = {
        received: 0,
        processed: 0,
        errors: 0,
      }
    }
  }

  /**
   * Start the shadow consumer
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error("Shadow consumer is already running")
    }

    if (!this.client.isConnected()) {
      throw new Error("Queue client is not connected")
    }

    try {
      // Create channels and start consuming from each queue
      for (const queueName of this.config.queues) {
        const channel = await this.client.createChannel(`shadow-consumer-${queueName}`)
        this.channels.set(queueName, channel)

        // Set up consumer for this queue
        await channel.consume(
          queueName,
          async (msg) => {
            if (msg) {
              await this.handleMessage(queueName, msg)
              channel.ack(msg)
            }
          },
          {
            noAck: false,
            consumerTag: `shadow-consumer-${queueName}`,
          },
        )

        this.logger.debug(`Shadow consumer started for queue: ${queueName}`)
      }

      this.running = true
      this.stats.isRunning = true
      this.stats.startTime = new Date()

      // Start metrics reporting
      this.startMetricsReporting()

      this.logger.info(`Shadow consumer monitoring ${this.config.queues.length} queues`)
    } catch (error) {
      this.logger.error(`Failed to start shadow consumer: ${error}`)
      await this.cleanup()
      throw error
    }
  }

  /**
   * Stop the shadow consumer
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return
    }

    this.logger.info("Stopping shadow consumer...")

    this.running = false
    this.stats.isRunning = false

    // Stop metrics reporting
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer)
      this.metricsTimer = null
    }

    // Cancel consumers and close channels
    await this.cleanup()

    this.logger.info("Shadow consumer stopped")
  }

  /**
   * Get current consumer statistics
   */
  getStats(): ShadowConsumerStats {
    return {
      ...this.stats,
      eventsReceived: this.stats.eventsReceived,
      eventsProcessed: this.stats.eventsProcessed,
      validationErrors: this.stats.validationErrors,
    }
  }

  /**
   * Validate an event against the shadow consumer's received events
   * This is called by the dual publisher to cross-validate events
   */
  validateEvent(event: BaseEvent): boolean {
    const eventKey = this.generateEventKey(event)
    const shadowEvent = this.eventBuffer.get(eventKey)

    if (!shadowEvent) {
      this.logger.debug(`Event not found in shadow buffer: ${eventKey}`)
      return false
    }

    // Convert timestamp to Date if it's a string
    const shadowTimestamp =
      typeof shadowEvent.timestamp === "string"
        ? new Date(shadowEvent.timestamp)
        : shadowEvent.timestamp
    const eventTimestamp =
      typeof event.timestamp === "string" ? new Date(event.timestamp) : event.timestamp

    // Basic validation - compare event types and timestamps
    const isValid =
      shadowEvent.eventType === event.eventType &&
      shadowTimestamp.getTime() === eventTimestamp.getTime() &&
      shadowEvent.serverId === event.serverId

    if (!isValid) {
      this.stats.validationErrors++
      this.logger.warn(`Event validation failed for ${eventKey}`)
    }

    // Remove from buffer after validation
    this.eventBuffer.delete(eventKey)

    return isValid
  }

  /**
   * Handle a message from RabbitMQ
   */
  private async handleMessage(queueName: string, msg: { content: Buffer } | null): Promise<void> {
    if (!msg) {
      return
    }

    try {
      this.stats.eventsReceived++
      this.stats.queueStats[queueName]!.received++

      // Parse the event message
      const content = msg.content.toString()
      const parseResult = safeJsonParse<EventMessage>(content)

      if (!parseResult.success) {
        if (this.config.logParsingErrors) {
          this.logger.warn(
            `Failed to parse event message from queue ${queueName}: ${parseResult.error}`,
          )
        }
        if (this.config.logRawMessages) {
          this.logger.debug(`Raw message content: ${content.substring(0, 200)}...`)
        }
        this.stats.queueStats[queueName]!.errors++
        this.stats.validationErrors++
        return
      }

      // Extract the event from the message
      const eventMessage = parseResult.data
      const event = eventMessage.payload

      // Convert timestamp string back to Date object if needed
      if (typeof event.timestamp === "string") {
        event.timestamp = new Date(event.timestamp)
      }

      if (this.config.logEvents) {
        this.logger.debug(
          `Shadow consumer received event: ${event.eventType} (server: ${event.serverId})`,
        )
      }

      // Add to buffer for validation
      const eventKey = this.generateEventKey(event)

      // Prevent buffer overflow
      if (this.eventBuffer.size >= this.config.maxBufferSize) {
        // Remove oldest entry
        const firstKey = this.eventBuffer.keys().next().value
        if (firstKey) {
          this.eventBuffer.delete(firstKey)
        }
      }

      this.eventBuffer.set(eventKey, event)

      this.stats.eventsProcessed++
      this.stats.queueStats[queueName]!.processed++
      this.stats.queueStats[queueName]!.lastProcessedAt = new Date()
    } catch (error) {
      this.logger.error(`Error handling message from queue ${queueName}: ${error}`)
      if (this.config.logRawMessages) {
        this.logger.debug(`Message content was: ${msg?.content?.toString().substring(0, 500)}...`)
      }
      this.stats.queueStats[queueName]!.errors++
      this.stats.validationErrors++
    }
  }

  /**
   * Generate a unique key for an event for buffer management
   */
  private generateEventKey(event: BaseEvent): string {
    return `${event.eventType}:${event.serverId}:${event.timestamp.getTime()}`
  }

  /**
   * Start periodic metrics reporting
   */
  private startMetricsReporting(): void {
    this.metricsTimer = setInterval(() => {
      this.logMetrics()
    }, this.config.metricsInterval)
  }

  /**
   * Log current metrics
   */
  private logMetrics(): void {
    const uptime = Date.now() - this.stats.startTime.getTime()
    const eventsPerSecond = this.stats.eventsReceived / (uptime / 1000)

    this.logger.info(`Shadow Consumer Metrics:`)
    this.logger.info(`  Events Received: ${this.stats.eventsReceived}`)
    this.logger.info(`  Events Processed: ${this.stats.eventsProcessed}`)
    this.logger.info(`  Validation Errors: ${this.stats.validationErrors}`)
    this.logger.info(`  Events/sec: ${eventsPerSecond.toFixed(2)}`)
    this.logger.info(`  Buffer Size: ${this.eventBuffer.size}/${this.config.maxBufferSize}`)

    // Log per-queue stats
    for (const [queueName, queueStats] of Object.entries(this.stats.queueStats)) {
      this.logger.info(
        `  Queue ${queueName}: ${queueStats.received} received, ${queueStats.processed} processed, ${queueStats.errors} errors`,
      )
    }
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    // Cancel consumers and close channels
    for (const [queueName, channel] of this.channels) {
      try {
        await channel.cancel(`shadow-consumer-${queueName}`)
        await channel.close()
        this.logger.debug(`Closed shadow consumer channel for queue: ${queueName}`)
      } catch (error) {
        this.logger.warn(`Failed to close shadow consumer channel for queue ${queueName}: ${error}`)
      }
    }

    this.channels.clear()
    this.eventBuffer.clear()
  }
}

/**
 * Default configuration for shadow consumer
 */
export const defaultShadowConsumerConfig: ShadowConsumerConfig = {
  queues: ["hlstats.events.priority", "hlstats.events.standard", "hlstats.events.bulk"],
  metricsInterval: 30000, // 30 seconds
  logEvents: false,
  logParsingErrors: true, // Always log parsing errors
  logRawMessages: false, // Only log raw messages when explicitly enabled
  maxBufferSize: 10000,
}

/**
 * Factory function to create a shadow consumer
 */
export function createShadowConsumer(
  client: IQueueClient,
  logger: ILogger,
  config?: Partial<ShadowConsumerConfig>,
): ShadowConsumer {
  const mergedConfig = { ...defaultShadowConsumerConfig, ...config }
  return new ShadowConsumer(client, mergedConfig, logger)
}
