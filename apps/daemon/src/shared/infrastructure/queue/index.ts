/**
 * Queue Infrastructure Module
 *
 * Main exports for the RabbitMQ queue infrastructure
 */

// Core types
export type {
  IQueueClient,
  IEventPublisher,
  IEventConsumer,
  RabbitMQConfig,
  QueueConfig,
  EventMessage,
  MessageMetadata,
  ConsumerStats,
  ConnectionStats,
  QueueModuleDependencies,
  RoutingKeyMapper,
  PriorityMapper,
  MessageValidator,
  HealthCheckResult,
  QueueHealthConfig,
} from "./queue.types"

export {
  MessagePriority,
  QueueError,
  QueueConnectionError,
  QueuePublishError,
  QueueConsumeError,
} from "./queue.types"

// Core implementations
export { RabbitMQClient } from "./rabbitmq.client"
export { EventPublisher, defaultRoutingKeyMapper, defaultPriorityMapper } from "./event-publisher"
export {
  EventConsumer,
  defaultConsumerConfig,
  defaultMessageValidator,
  type IEventProcessor,
  type ConsumerConfig,
} from "./event-consumer"

export {
  RabbitMQConsumer,
  defaultRabbitMQConsumerConfig,
  type RabbitMQConsumerConfig,
} from "./rabbitmq-consumer"

export { RabbitMQEventProcessor } from "./rabbitmq-event-processor"

// Utilities
export {
  generateMessageId,
  generateCorrelationId,
  isValidMessageId,
  isValidCorrelationId,
  extractTimestampFromMessageId,
  calculateMessageAge,
  sanitizeRoutingKey,
  calculateRetryDelay,
  addJitter,
  formatBytes,
  formatDuration,
  safeJsonStringify,
  safeJsonParse,
} from "./utils"

// Migration support
export {
  DualEventPublisher,
  defaultDualPublisherConfig,
  createDualEventPublisher,
  type DualPublisherConfig,
  type DualPublisherStats,
} from "./dual-event-publisher"

export {
  QueueFirstPublisher,
  type QueueFirstMetrics,
} from "./queue-first-publisher"

export {
  ShadowConsumer,
  defaultShadowConsumerConfig,
  createShadowConsumer,
  type ShadowConsumerConfig,
  type ShadowConsumerStats,
} from "./shadow-consumer"

// Dependency injection module
export {
  QueueModule,
  defaultQueueModuleConfig,
  createQueueModule,
  createDevelopmentRabbitMQConfig,
  type QueueModuleConfig,
  type QueueModuleStatus,
} from "./queue.module"

// Adapters (typically not needed by consumers)
export { AmqpChannelAdapter, AmqpConnectionAdapter } from "./adapters"
