/**
 * Queue Infrastructure Types
 *
 * Type definitions for the RabbitMQ message queue system following Domain-Driven Design principles.
 */

import type { BaseEvent } from "@/shared/types/events"

/**
 * Queue client interface for dependency injection
 */
export interface IQueueClient {
  connect(): Promise<void>
  disconnect(): Promise<void>
  createChannel(name: string): Promise<QueueChannel>
  isConnected(): boolean
  getConnectionStats(): ConnectionStats
}

/**
 * Event publisher interface
 */
export interface IEventPublisher {
  publish<T extends BaseEvent>(event: T): Promise<void>
  publishBatch<T extends BaseEvent>(events: T[]): Promise<void>
}

/**
 * Event consumer interface
 */
export interface IEventConsumer {
  start(): Promise<void>
  stop(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  getConsumerStats(): ConsumerStats
}

/**
 * RabbitMQ configuration with strict typing
 */
export interface RabbitMQConfig {
  readonly url: string
  readonly prefetchCount: number
  readonly heartbeatInterval: number
  readonly connectionRetry: {
    readonly maxAttempts: number
    readonly initialDelay: number
    readonly maxDelay: number
  }
  readonly queues: {
    readonly priority: QueueConfig
    readonly standard: QueueConfig
    readonly bulk: QueueConfig
  }
}

/**
 * Individual queue configuration
 */
export interface QueueConfig {
  readonly name: string
  readonly bindings: readonly string[]
  readonly options: {
    readonly durable: boolean
    readonly autoDelete: boolean
    readonly messageTtl?: number
    readonly maxLength?: number
    readonly deadLetterExchange?: string
  }
}

/**
 * Message format for events in the queue
 */
export interface EventMessage<T extends BaseEvent = BaseEvent> {
  /** Unique message identifier */
  readonly id: string
  
  /** Message version for schema evolution */
  readonly version: '1.0'
  
  /** ISO timestamp of message creation */
  readonly timestamp: string
  
  /** Correlation ID for distributed tracing */
  readonly correlationId: string
  
  /** Message metadata */
  readonly metadata: MessageMetadata
  
  /** The actual event payload */
  readonly payload: T
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  /** Source server identification */
  readonly source: {
    readonly serverId: number
    readonly serverAddress: string
    readonly serverPort: number
  }
  
  /** Message routing information */
  readonly routing: {
    readonly key: string
    readonly priority: MessagePriority
    readonly retryCount: number
  }
  
  /** Processing hints */
  readonly hints?: {
    readonly skipValidation?: boolean
    readonly requiresAck?: boolean
  }
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  HIGH = 10,
  NORMAL = 5,
  LOW = 1
}

/**
 * Queue topology configuration
 */
export interface QueueTopology {
  exchanges: {
    events: {
      name: 'hlstats.events'
      type: 'topic'
      durable: true
    }
    dlx: {
      name: 'hlstats.events.dlx'
      type: 'topic'
      durable: true
    }
  }
  queues: {
    priority: {
      name: 'hlstats.events.priority'
      bindings: readonly string[]
      options: QueueOptions
    }
    standard: {
      name: 'hlstats.events.standard'
      bindings: readonly string[]
      options: QueueOptions
    }
    bulk: {
      name: 'hlstats.events.bulk'
      bindings: readonly string[]
      options: QueueOptions
    }
  }
}

/**
 * Queue options for configuration
 */
export interface QueueOptions {
  readonly durable: boolean
  readonly autoDelete: boolean
  readonly exclusive?: boolean
  readonly arguments?: Record<string, unknown>
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
  connected: boolean
  heartbeatsSent: number
  heartbeatsMissed: number
  channelsCount: number
  uptime: number
}

/**
 * Consumer statistics
 */
export interface ConsumerStats {
  isConsuming: boolean
  messagesProcessed: number
  messagesAcked: number
  messagesNacked: number
  messagesRejected: number
  averageProcessingTime: number
  queueDepth: number
}

/**
 * Queue channel abstraction (wraps amqplib channel)
 */
export interface QueueChannel {
  publish(exchange: string, routingKey: string, content: Buffer, options?: PublishOptions): boolean
  consume(queue: string, onMessage: (msg: ConsumeMessage | null) => void, options?: ConsumeOptions): Promise<string>
  cancel(consumerTag: string): Promise<void>
  ack(message: ConsumeMessage): void
  nack(message: ConsumeMessage, allUpTo?: boolean, requeue?: boolean): void
  prefetch(count: number): Promise<void>
  assertExchange(exchange: string, type: string, options?: AssertExchangeOptions): Promise<void>
  assertQueue(queue: string, options?: AssertQueueOptions): Promise<void>
  bindQueue(queue: string, source: string, pattern: string): Promise<void>
  close(): Promise<void>
}

/**
 * Queue connection abstraction
 */
export interface QueueConnection {
  createChannel(): Promise<QueueChannel>
  close(): Promise<void>
  on(event: string, listener: (...args: unknown[]) => void): void
}

/**
 * Message from queue consumption
 */
export interface ConsumeMessage {
  content: Buffer
  fields: {
    deliveryTag: number
    redelivered: boolean
    exchange: string
    routingKey: string
  }
  properties: {
    messageId?: string
    timestamp?: number
    headers?: Record<string, unknown>
    correlationId?: string
    replyTo?: string
    expiration?: string
    priority?: number
  }
}

/**
 * Publish options
 */
export interface PublishOptions {
  persistent?: boolean
  priority?: number
  messageId?: string
  timestamp?: number
  headers?: Record<string, unknown>
  correlationId?: string
  replyTo?: string
  expiration?: string
}

/**
 * Consume options
 */
export interface ConsumeOptions {
  noAck?: boolean
  consumerTag?: string
  exclusive?: boolean
  priority?: number
}

/**
 * Exchange assertion options
 */
export interface AssertExchangeOptions {
  durable?: boolean
  internal?: boolean
  autoDelete?: boolean
  alternateExchange?: string
  arguments?: Record<string, unknown>
}

/**
 * Queue assertion options
 */
export interface AssertQueueOptions {
  exclusive?: boolean
  durable?: boolean
  autoDelete?: boolean
  arguments?: Record<string, unknown>
  messageTtl?: number
  expires?: number
  maxLength?: number
  maxPriority?: number
  deadLetterExchange?: string
  deadLetterRoutingKey?: string
}

/**
 * Queue error types
 */
export class QueueError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'QueueError'
  }
}

export class QueueConnectionError extends QueueError {
  constructor(message: string, cause?: Error) {
    super(message, cause)
    this.name = 'QueueConnectionError'
  }
}

export class QueuePublishError extends QueueError {
  constructor(message: string, cause?: Error) {
    super(message, cause)
    this.name = 'QueuePublishError'
  }
}

export class QueueConsumeError extends QueueError {
  constructor(message: string, cause?: Error) {
    super(message, cause)
    this.name = 'QueueConsumeError'
  }
}

/**
 * Queue module dependencies for dependency injection
 */
export interface QueueModuleDependencies {
  readonly client: IQueueClient
  readonly publisher: IEventPublisher
  readonly consumer: IEventConsumer | null
}

/**
 * Routing key mapping function type
 */
export type RoutingKeyMapper = (event: BaseEvent) => string

/**
 * Priority mapping function type
 */
export type PriorityMapper = (event: BaseEvent) => MessagePriority

/**
 * Message validation function type
 */
export type MessageValidator = (message: EventMessage) => Promise<void>

/**
 * Health check result
 */
export interface HealthCheckResult {
  readonly name: string
  readonly healthy: boolean
  readonly details?: Record<string, unknown>
  readonly error?: string
}

/**
 * Queue health check configuration
 */
export interface QueueHealthConfig {
  readonly connectionTimeout: number
  readonly queueDepthWarningThreshold: number
  readonly queueDepthCriticalThreshold: number
  readonly consumerLagWarningThreshold: number
}