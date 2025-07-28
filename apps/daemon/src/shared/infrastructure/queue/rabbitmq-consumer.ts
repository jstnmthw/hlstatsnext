/**
 * RabbitMQ Consumer Implementation
 *
 * Specialized consumer for processing events from RabbitMQ queues through
 * the existing application infrastructure (sagas, coordinators, modules).
 * Uses "QUEUE" prefix logging to distinguish from EventBus processing.
 */

import type {
  IQueueClient,
  MessageValidator,
} from "./queue.types"
import type { ConsumerConfig } from "./event-consumer"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventCoordinator } from "@/shared/application/event-coordinator"
import { EventConsumer, defaultConsumerConfig, defaultMessageValidator } from "./event-consumer"
import { RabbitMQEventProcessor } from "./rabbitmq-event-processor"

/**
 * Configuration for RabbitMQ consumer
 */
export interface RabbitMQConsumerConfig extends ConsumerConfig {}

/**
 * Default configuration for RabbitMQ consumer
 */
export const defaultRabbitMQConsumerConfig: RabbitMQConsumerConfig = {
  ...defaultConsumerConfig,
}

/**
 * RabbitMQ Consumer that processes events through the application infrastructure
 */
export class RabbitMQConsumer {
  private eventProcessor: RabbitMQEventProcessor
  private consumer: EventConsumer

  constructor(
    private readonly client: IQueueClient,
    private readonly logger: ILogger,
    private readonly coordinators: EventCoordinator[] = [],
    private readonly config: RabbitMQConsumerConfig = defaultRabbitMQConsumerConfig,
    private readonly messageValidator: MessageValidator = defaultMessageValidator,
  ) {
    // Create the queue-specific event processor
    this.eventProcessor = new RabbitMQEventProcessor(
      this.logger,
      this.coordinators,
    )

    // Create the underlying consumer
    this.consumer = new EventConsumer(
      this.client,
      this.eventProcessor,
      this.logger,
      this.config,
      this.messageValidator,
    )
  }


  /**
   * Start consuming events from RabbitMQ
   */
  async start(): Promise<void> {
    this.logger.queue("Starting RabbitMQ consumer", {
      queues: this.config.queues,
      concurrency: this.config.concurrency,
      coordinators: this.coordinators.length,
    })

    await this.consumer.start()
    
    this.logger.queue("RabbitMQ consumer started successfully")
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    this.logger.queue("Stopping RabbitMQ consumer")
    
    await this.consumer.stop()
    
    this.logger.queue("RabbitMQ consumer stopped successfully")
  }

  /**
   * Pause event consumption
   */
  async pause(): Promise<void> {
    await this.consumer.pause()
  }

  /**
   * Resume event consumption
   */
  async resume(): Promise<void> {
    await this.consumer.resume()
  }

  /**
   * Get consumer statistics
   */
  getConsumerStats() {
    return this.consumer.getConsumerStats()
  }
}