/**
 * Queue Module
 *
 * Dependency injection module for RabbitMQ queue infrastructure.
 * Provides factory methods for creating and configuring queue services.
 */

import type { EventCoordinator } from "@/shared/application/event-coordinator"
import type { ModuleRegistry } from "@/shared/infrastructure/modules/registry"
import type { ILogger } from "@/shared/utils/logger.types"
import type { PrometheusMetricsExporter } from "@repo/observability"
import { EventConsumer, type IEventProcessor } from "./queue/core/consumer"
import { EventPublisher } from "./queue/core/publisher"
import type {
  ConnectionStats,
  ConsumerStats,
  IEventConsumer,
  IEventPublisher,
  IQueueClient,
  QueueModuleDependencies,
  RabbitMQConfig,
} from "./queue/core/types"
import { RabbitMQClient } from "./queue/rabbitmq/client"
import { RabbitMQConsumer } from "./queue/rabbitmq/consumer"

/**
 * Configuration for the queue module
 */
export interface QueueModuleConfig {
  /** RabbitMQ connection configuration */
  readonly rabbitmq: RabbitMQConfig
  /** Whether to start consumers automatically */
  readonly autoStartConsumers: boolean
  /** Whether to setup topology automatically */
  readonly autoSetupTopology: boolean
}

/**
 * Queue module for dependency injection and service creation
 */
export class QueueModule {
  private client: IQueueClient | null = null
  private publisher: IEventPublisher | null = null
  private consumer: IEventConsumer | null = null
  private rabbitmqConsumer: RabbitMQConsumer | null = null

  constructor(
    private readonly config: QueueModuleConfig,
    private readonly logger: ILogger,
  ) {}

  /**
   * Initialize the queue module and create all services
   */
  async initialize(eventProcessor?: IEventProcessor): Promise<QueueModuleDependencies> {
    try {
      // Create and connect RabbitMQ client
      this.client = new RabbitMQClient(this.config.rabbitmq, this.logger)
      await this.client.connect()

      // Create publisher
      this.publisher = new EventPublisher(this.client, this.logger)

      // Create consumer if event processor is provided
      if (eventProcessor) {
        this.consumer = new EventConsumer(this.client, eventProcessor, this.logger)

        if (this.config.autoStartConsumers) {
          await this.consumer.start()
        }
      }

      this.logger.info("Queue module initialized successfully")

      return {
        client: this.client,
        publisher: this.publisher,
        consumer: this.consumer,
      }
    } catch (error) {
      this.logger.error(`Failed to initialize queue module: ${error}`)
      throw error
    }
  }

  /**
   * Get the queue client
   */
  getClient(): IQueueClient {
    if (!this.client) {
      throw new Error("Queue module not initialized - client not available")
    }
    return this.client
  }

  /**
   * Get the event publisher
   */
  getPublisher(): IEventPublisher {
    if (!this.publisher) {
      throw new Error("Queue module not initialized - publisher not available")
    }
    return this.publisher
  }

  /**
   * Get the event consumer
   */
  getConsumer(): IEventConsumer {
    if (!this.consumer) {
      throw new Error("Queue module not initialized - consumer not available")
    }
    return this.consumer
  }

  /**
   * Start RabbitMQ consumer integrated with the module registry
   */
  async startRabbitMQConsumer(
    moduleRegistry: ModuleRegistry,
    coordinators: EventCoordinator[] = [],
    metrics?: PrometheusMetricsExporter,
  ): Promise<RabbitMQConsumer> {
    if (!this.client) {
      throw new Error("Queue module not initialized - client not available")
    }

    const consumer = new RabbitMQConsumer(
      this.client,
      this.logger,
      moduleRegistry,
      coordinators,
      undefined,
      undefined,
      metrics,
    )
    await consumer.start()
    this.rabbitmqConsumer = consumer
    return consumer
  }

  /**
   * Get the started RabbitMQ consumer instance
   */
  getRabbitMQConsumer(): RabbitMQConsumer {
    if (!this.rabbitmqConsumer) {
      throw new Error("RabbitMQ consumer not started")
    }
    return this.rabbitmqConsumer
  }

  /**
   * Check if the module is initialized
   */
  isInitialized(): boolean {
    return this.client !== null && this.publisher !== null
  }

  /**
   * Get module status and statistics
   */
  getStatus(): QueueModuleStatus {
    return {
      initialized: this.isInitialized(),
      connected: this.client?.isConnected() ?? false,
      connectionStats: this.client?.getConnectionStats(),
      consumerStats: this.consumer?.getConsumerStats(),
    }
  }

  /**
   * Gracefully shutdown the queue module
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down queue module...")

    try {
      // Stop rabbitmq consumer wrapper if running
      if (this.rabbitmqConsumer) {
        await this.rabbitmqConsumer.stop()
        this.rabbitmqConsumer = null
      }

      // Stop consumer
      if (this.consumer) {
        await this.consumer.stop()
        this.consumer = null
      }

      // Disconnect client
      if (this.client) {
        await this.client.disconnect()
        this.client = null
      }

      // Reset other services
      this.publisher = null

      this.logger.info("Queue module shutdown complete")
    } catch (error) {
      this.logger.error(`Error during queue module shutdown: ${error}`)
      throw error
    }
  }
}

/**
 * Queue module status information
 */
export interface QueueModuleStatus {
  readonly initialized: boolean
  readonly connected: boolean
  readonly connectionStats?: ConnectionStats
  readonly consumerStats?: ConsumerStats
}

/**
 * Default queue module configuration
 */
export const defaultQueueModuleConfig: Omit<QueueModuleConfig, "rabbitmq"> = {
  autoStartConsumers: false,
  autoSetupTopology: true,
}

/**
 * Create a queue module with default configuration
 */
export function createQueueModule(
  rabbitmqConfig: RabbitMQConfig,
  logger: ILogger,
  overrides?: Partial<QueueModuleConfig>,
): QueueModule {
  const config: QueueModuleConfig = {
    ...defaultQueueModuleConfig,
    rabbitmq: rabbitmqConfig,
    ...overrides,
  }

  return new QueueModule(config, logger)
}

/**
 * Create a default RabbitMQ configuration for development
 */
export function createDevelopmentRabbitMQConfig(url?: string): RabbitMQConfig {
  return {
    url: url || "amqp://hlstats:hlstats-mq-dev@localhost:5672/hlstats",
    prefetchCount: 10,
    heartbeatInterval: 60,
    connectionRetry: {
      maxAttempts: 5,
      initialDelay: 1000,
      maxDelay: 10000,
    },
    queues: {
      priority: {
        name: "hlstats.events.priority",
        bindings: ["player.kill", "player.suicide", "player.teamkill", "action.*"],
        options: {
          durable: true,
          autoDelete: false,
          messageTtl: 3600000, // 1 hour
          maxLength: 50000,
          deadLetterExchange: "hlstats.events.dlx",
        },
      },
      standard: {
        name: "hlstats.events.standard",
        bindings: [
          "player.connect",
          "player.disconnect",
          "player.entry",
          "player.change.*",
          "admin.*",
          "team.*",
          "map.*",
          "round.*",
          "bomb.*",
          "hostage.*",
          "flag.*",
          "control.*",
        ],
        options: {
          durable: true,
          autoDelete: false,
          messageTtl: 3600000, // 1 hour
          maxLength: 75000,
          deadLetterExchange: "hlstats.events.dlx",
        },
      },
      bulk: {
        name: "hlstats.events.bulk",
        bindings: ["weapon.*", "stats.*", "chat.*"],
        options: {
          durable: true,
          autoDelete: false,
          messageTtl: 3600000, // 1 hour
          maxLength: 100000,
          deadLetterExchange: "hlstats.events.dlx",
        },
      },
    },
  }
}
