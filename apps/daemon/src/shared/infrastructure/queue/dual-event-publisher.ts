/**
 * Dual Event Publisher Implementation
 *
 * Implements dual-write pattern for gradual migration from EventBus to RabbitMQ.
 * Publishes events to both systems with graceful fallback to EventBus on queue failures.
 */

import type { IEventPublisher } from "./queue.types"
import type { IEventBus } from "../event-bus/event-bus.types"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"

/**
 * Configuration for dual event publisher
 */
export interface DualPublisherConfig {
  /** Whether to enable queue publishing */
  readonly enableQueue: boolean
  /** Whether to continue on queue failures */
  readonly gracefulFallback: boolean
  /** Whether to emit to EventBus */
  readonly enableEventBus: boolean
  /** Timeout for queue operations in milliseconds */
  readonly queueTimeout: number
}

/**
 * Statistics for dual publisher operations
 */
export interface DualPublisherStats {
  totalEvents: number
  eventBusSuccess: number
  eventBusFailures: number
  queueSuccess: number
  queueFailures: number
  dualSuccess: number
  fallbackToEventBus: number
}

/**
 * Dual event publisher that writes to both EventBus and RabbitMQ
 * with graceful fallback and metrics tracking
 */
export class DualEventPublisher implements IEventPublisher {
  private stats: DualPublisherStats = {
    totalEvents: 0,
    eventBusSuccess: 0,
    eventBusFailures: 0,
    queueSuccess: 0,
    queueFailures: 0,
    dualSuccess: 0,
    fallbackToEventBus: 0,
  }

  constructor(
    private readonly eventBus: IEventBus,
    private readonly queuePublisher: IEventPublisher,
    private readonly logger: ILogger,
    private readonly config: DualPublisherConfig = defaultDualPublisherConfig,
  ) {}

  async publish<T extends BaseEvent>(event: T): Promise<void> {
    this.stats.totalEvents++

    const promises: Promise<{ source: string; success: boolean; error?: Error }>[] = []

    // Publish to EventBus if enabled
    if (this.config.enableEventBus) {
      promises.push(
        this.publishToEventBus(event).then(
          () => ({ source: "eventbus", success: true }),
          (error) => ({ source: "eventbus", success: false, error: error as Error }),
        ),
      )
    }

    // Publish to Queue if enabled
    if (this.config.enableQueue) {
      promises.push(
        this.publishToQueue(event).then(
          () => ({ source: "queue", success: true }),
          (error) => ({ source: "queue", success: false, error: error as Error }),
        ),
      )
    }

    // Wait for all publishing attempts
    const results = await Promise.all(promises)

    // Process results and update statistics
    let eventBusSuccess = false
    let queueSuccess = false

    for (const result of results) {
      if (result.source === "eventbus") {
        if (result.success) {
          this.stats.eventBusSuccess++
          eventBusSuccess = true
        } else {
          this.stats.eventBusFailures++
          this.logger.error(`EventBus publish failed: ${result.error?.message}`)
        }
      } else if (result.source === "queue") {
        if (result.success) {
          this.stats.queueSuccess++
          queueSuccess = true
        } else {
          this.stats.queueFailures++
          this.logger.error(`Queue publish failed: ${result.error?.message}`)
        }
      }
    }

    // Handle success/failure scenarios
    if (this.config.enableEventBus && this.config.enableQueue) {
      if (eventBusSuccess && queueSuccess) {
        this.stats.dualSuccess++
        this.logger.debug(`Event ${event.eventType} published to both EventBus and Queue`)
      } else if (eventBusSuccess && !queueSuccess && this.config.gracefulFallback) {
        this.stats.fallbackToEventBus++
        this.logger.warn(`Event ${event.eventType} published to EventBus only (queue failed)`)
      } else if (!eventBusSuccess && !queueSuccess) {
        throw new Error(`Failed to publish event ${event.eventType} to both EventBus and Queue`)
      }
    } else if (this.config.enableEventBus && !eventBusSuccess) {
      throw new Error(`Failed to publish event ${event.eventType} to EventBus`)
    } else if (this.config.enableQueue && !queueSuccess) {
      throw new Error(`Failed to publish event ${event.eventType} to Queue`)
    }
  }

  async publishBatch<T extends BaseEvent>(events: T[]): Promise<void> {
    // Process events sequentially to maintain order and proper error handling
    for (const event of events) {
      await this.publish(event)
    }
  }

  /**
   * Get publisher statistics
   */
  getStats(): DualPublisherStats {
    return { ...this.stats }
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.stats = {
      totalEvents: 0,
      eventBusSuccess: 0,
      eventBusFailures: 0,
      queueSuccess: 0,
      queueFailures: 0,
      dualSuccess: 0,
      fallbackToEventBus: 0,
    }
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<DualPublisherConfig>): void {
    Object.assign(this.config, newConfig)
    this.logger.info(`Dual publisher configuration updated: ${JSON.stringify(this.config)}`)
  }

  private async publishToEventBus<T extends BaseEvent>(event: T): Promise<void> {
    const startTime = Date.now()
    try {
      await this.eventBus.emit(event)
      const duration = Date.now() - startTime
      this.logger.debug(`EventBus publish completed in ${duration}ms for ${event.eventType}`)
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error(
        `EventBus publish failed after ${duration}ms for ${event.eventType}: ${error}`,
      )
      throw error
    }
  }

  private async publishToQueue<T extends BaseEvent>(event: T): Promise<void> {
    const startTime = Date.now()

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Queue publish timeout")), this.config.queueTimeout)
    })

    try {
      // Race between publish and timeout
      await Promise.race([this.queuePublisher.publish(event), timeoutPromise])

      const duration = Date.now() - startTime
      this.logger.debug(`Queue publish completed in ${duration}ms for ${event.eventType}`)
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error(`Queue publish failed after ${duration}ms for ${event.eventType}: ${error}`)
      throw error
    }
  }
}

/**
 * Default configuration for dual publisher
 */
export const defaultDualPublisherConfig: DualPublisherConfig = {
  enableQueue: true,
  gracefulFallback: true,
  enableEventBus: true,
  queueTimeout: 5000, // 5 seconds
}

/**
 * Creates a dual publisher for migration scenarios
 */
export function createDualEventPublisher(
  eventBus: IEventBus,
  queuePublisher: IEventPublisher,
  logger: ILogger,
  config?: Partial<DualPublisherConfig>,
): DualEventPublisher {
  const finalConfig = { ...defaultDualPublisherConfig, ...config }
  return new DualEventPublisher(eventBus, queuePublisher, logger, finalConfig)
}
