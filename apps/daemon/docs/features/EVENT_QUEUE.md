# HLStatsNext Daemon - RabbitMQ Integration Technical Design Document

This document outlines the integration of RabbitMQ as the message queue system for the HLStatsNext daemon, replacing the current in-memory EventBus with a robust, scalable, and production-ready message queue infrastructure. The design follows our established architectural patterns and best practices while maintaining backward compatibility during the migration phase.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Design Principles](#design-principles)
3. [Message Queue Architecture](#message-queue-architecture)
4. [Implementation Plan](#implementation-plan)
5. [Type System Design](#type-system-design)
6. [Service Integration](#service-integration)
7. [Migration Strategy](#migration-strategy)
8. [Testing Approach](#testing-approach)
9. [Monitoring & Operations](#monitoring--operations)
10. [Performance Considerations](#performance-considerations)

## 1. Architecture Overview

### Current State

- **In-memory EventBus**: Synchronous event processing with no persistence
- **Direct coupling**: IngressService → EventBus → EventProcessor → Services
- **No horizontal scaling**: Single daemon instance limitation
- **No fault tolerance**: Events lost on crash

### Target State

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│   Game Server   │────▶│  UDP Ingress     │────▶│    RabbitMQ          │
│                 │ UDP │  (Parse & Auth)  │     │   (Topic Exchange)   │
└─────────────────┘     └──────────────────┘     └──────────┬───────────┘
                                                            │
                                ┌───────────────────────────▼─────────────┐
                                │         Worker Pool (N instances)       │
                                │  ┌─────────────┬─────────────────────┐  │
                                │  │ Worker 1    │    Worker N         │  │
                                │  │ - Process   │    - Process        │  │
                                │  │ - Retry     │    - Retry          │  │
                                │  │ - Route     │    - Route          │  │
                                │  └─────────────┴─────────────────────┘  │
                                └─────────────────────────────────────────┘
```

---

## 2. Design Principles

Following our established patterns from `@docs/BEST_PRACTICES.md`:

1. **Domain-Driven Design**: Queue infrastructure as a separate domain
2. **SOLID Principles**: Clean interfaces and dependency inversion
3. **Type Safety**: Zero `any` types, strict TypeScript configuration
4. **Testability**: Mock-friendly interfaces and comprehensive test coverage
5. **Observability**: Built-in metrics and tracing

---

## 3. Message Queue Architecture

### 3.1 Exchange and Queue Design

```typescript
// src/shared/infrastructure/queue/queue.types.ts
export interface QueueTopology {
  exchanges: {
    events: {
      name: "hlstats.events"
      type: "topic"
      durable: true
    }
    dlx: {
      name: "hlstats.events.dlx"
      type: "topic"
      durable: true
    }
  }
  queues: {
    priority: {
      name: "hlstats.events.priority"
      bindings: ["player.kill", "player.suicide", "round.*"]
      options: QueueOptions
    }
    standard: {
      name: "hlstats.events.standard"
      bindings: ["player.connect", "player.disconnect", "chat.*"]
      options: QueueOptions
    }
    bulk: {
      name: "hlstats.events.bulk"
      bindings: ["weapon.*", "action.*"]
      options: QueueOptions
    }
  }
}
```

### 3.2 Message Format

```typescript
// src/shared/infrastructure/queue/message.types.ts
export interface EventMessage<T extends BaseEvent = BaseEvent> {
  /** Unique message identifier */
  readonly id: string

  /** Message version for schema evolution */
  readonly version: "1.0"

  /** ISO timestamp of message creation */
  readonly timestamp: string

  /** Correlation ID for distributed tracing */
  readonly correlationId: string

  /** Message metadata */
  readonly metadata: MessageMetadata

  /** The actual event payload */
  readonly payload: T
}

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

export enum MessagePriority {
  HIGH = 10,
  NORMAL = 5,
  LOW = 1,
}
```

---

## 4. Implementation Plan

### 4.1 Core Queue Infrastructure

```typescript
// src/shared/infrastructure/queue/rabbitmq.client.ts
import amqp from "amqplib"
import type { IQueueClient, QueueConnection, QueueChannel } from "./queue.types"

export class RabbitMQClient implements IQueueClient {
  private connection: QueueConnection | null = null
  private channels: Map<string, QueueChannel> = new Map()

  constructor(
    private readonly config: RabbitMQConfig,
    private readonly logger: ILogger,
  ) {}

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.config.url, {
        heartbeat: 60,
        connectionTimeout: 10000,
      })

      this.connection.on("error", this.handleConnectionError.bind(this))
      this.connection.on("close", this.handleConnectionClose.bind(this))

      await this.setupTopology()

      this.logger.info("RabbitMQ connection established")
    } catch (error) {
      this.logger.error("Failed to connect to RabbitMQ", { error })
      throw new QueueConnectionError("RabbitMQ connection failed", error)
    }
  }

  async createChannel(name: string): Promise<QueueChannel> {
    if (!this.connection) {
      throw new QueueError("No active connection")
    }

    const channel = await this.connection.createChannel()
    await channel.prefetch(this.config.prefetchCount ?? 10)

    this.channels.set(name, channel)
    return channel
  }

  private async setupTopology(): Promise<void> {
    const channel = await this.createChannel("setup")

    // Create exchanges
    await channel.assertExchange("hlstats.events", "topic", {
      durable: true,
      autoDelete: false,
    })

    await channel.assertExchange("hlstats.events.dlx", "topic", {
      durable: true,
      autoDelete: false,
    })

    // Create queues with dead letter exchange
    const queueOptions = {
      durable: true,
      autoDelete: false,
      arguments: {
        "x-dead-letter-exchange": "hlstats.events.dlx",
        "x-message-ttl": 3600000, // 1 hour
      },
    }

    await channel.assertQueue("hlstats.events.priority", queueOptions)
    await channel.assertQueue("hlstats.events.standard", queueOptions)
    await channel.assertQueue("hlstats.events.bulk", queueOptions)

    // Create bindings
    await this.createBindings(channel)

    await channel.close()
    this.channels.delete("setup")
  }
}
```

### 4.2 Event Publisher Service

```typescript
// src/shared/infrastructure/queue/event-publisher.ts
export class EventPublisher implements IEventPublisher {
  private channel: QueueChannel | null = null

  constructor(
    private readonly client: IQueueClient,
    private readonly logger: ILogger,
    private readonly metrics: IMetricsService,
  ) {}

  async publish<T extends BaseEvent>(event: T): Promise<void> {
    const message = this.createMessage(event)
    const routingKey = this.getRoutingKey(event)
    const priority = this.getPriority(event)

    try {
      await this.ensureChannel()

      const published = this.channel!.publish(
        "hlstats.events",
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          priority,
          messageId: message.id,
          timestamp: Date.now(),
          headers: {
            "x-correlation-id": message.correlationId,
            "x-event-type": event.eventType,
            "x-server-id": event.serverId,
          },
        },
      )

      if (!published) {
        throw new QueuePublishError("Channel buffer full")
      }

      this.metrics.increment("queue.messages.published", {
        event_type: event.eventType,
        routing_key: routingKey,
      })
    } catch (error) {
      this.logger.error("Failed to publish event", {
        event: event.eventType,
        error,
      })

      this.metrics.increment("queue.messages.failed", {
        event_type: event.eventType,
        error: error.code,
      })

      throw error
    }
  }

  private createMessage<T extends BaseEvent>(event: T): EventMessage<T> {
    return {
      id: generateMessageId(),
      version: "1.0",
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId ?? generateCorrelationId(),
      metadata: {
        source: {
          serverId: event.serverId,
          serverAddress: event.serverAddress ?? "unknown",
          serverPort: event.serverPort ?? 0,
        },
        routing: {
          key: this.getRoutingKey(event),
          priority: this.getPriority(event),
          retryCount: 0,
        },
      },
      payload: event,
    }
  }

  private getRoutingKey(event: BaseEvent): string {
    // Map event types to routing keys
    const routingMap: Record<EventType, string> = {
      [EventType.PLAYER_KILL]: "player.kill",
      [EventType.PLAYER_SUICIDE]: "player.suicide",
      [EventType.PLAYER_CONNECT]: "player.connect",
      [EventType.PLAYER_DISCONNECT]: "player.disconnect",
      [EventType.ROUND_START]: "round.start",
      [EventType.ROUND_END]: "round.end",
      // ... other mappings
    }

    return routingMap[event.eventType] ?? "unknown"
  }
}
```

### 4.3 Event Consumer Worker

```typescript
// src/modules/worker/event-consumer.ts
export class EventConsumer implements IEventConsumer {
  private channel: QueueChannel | null = null
  private consumerTags: string[] = []

  constructor(
    private readonly client: IQueueClient,
    private readonly processor: IEventProcessor,
    private readonly logger: ILogger,
    private readonly metrics: IMetricsService,
  ) {}

  async start(): Promise<void> {
    await this.ensureChannel()

    // Subscribe to queues
    await this.consumeQueue("hlstats.events.priority")
    await this.consumeQueue("hlstats.events.standard")
    await this.consumeQueue("hlstats.events.bulk")

    this.logger.info("Event consumer started")
  }

  private async consumeQueue(queueName: string): Promise<void> {
    const consumerTag = await this.channel!.consume(
      queueName,
      async (msg) => {
        if (!msg) return

        const timer = this.metrics.startTimer("queue.message.processing_time")

        try {
          const message = this.parseMessage(msg)
          await this.processMessage(message)

          await this.channel!.ack(msg)

          timer({ status: "success", queue: queueName })
        } catch (error) {
          await this.handleError(msg, error)
          timer({ status: "error", queue: queueName })
        }
      },
      {
        noAck: false,
        consumerTag: `${queueName}-${process.pid}`,
      },
    )

    this.consumerTags.push(consumerTag)
  }

  private async processMessage(message: EventMessage): Promise<void> {
    const span = this.tracer.startSpan("queue.process_message", {
      attributes: {
        "message.id": message.id,
        "message.correlation_id": message.correlationId,
        "event.type": message.payload.eventType,
      },
    })

    try {
      // Validate message
      await this.validateMessage(message)

      // Process via existing event processor
      await this.processor.processEvent(message.payload)

      span.setStatus({ code: SpanStatusCode.OK })
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw error
    } finally {
      span.end()
    }
  }

  private async handleError(msg: ConsumeMessage, error: Error): Promise<void> {
    const message = this.parseMessage(msg)
    const retryCount = message.metadata.routing.retryCount

    if (retryCount < this.config.maxRetries) {
      // Requeue with exponential backoff
      const delay = Math.pow(2, retryCount) * 1000

      await this.channel!.nack(msg, false, false)

      setTimeout(async () => {
        const updatedMessage = {
          ...message,
          metadata: {
            ...message.metadata,
            routing: {
              ...message.metadata.routing,
              retryCount: retryCount + 1,
            },
          },
        }

        await this.publisher.republish(updatedMessage)
      }, delay)
    } else {
      // Send to dead letter queue
      await this.channel!.nack(msg, false, false)

      this.logger.error("Message exceeded retry limit", {
        messageId: message.id,
        eventType: message.payload.eventType,
        error,
      })
    }
  }
}
```

---

## 5. Type System Design

Following our strict TypeScript standards:

```typescript
// src/shared/infrastructure/queue/queue.types.ts

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
 * Queue configuration with strict typing
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
```

---

## 6. Service Integration

### 6.1 Modified IngressService

```typescript
// src/modules/ingress/ingress.service.ts
export class IngressService implements IIngressService {
  constructor(
    private readonly logger: ILogger,
    private readonly eventPublisher: IEventPublisher, // Changed from IEventBus
    private readonly dependencies: IngressDependencies,
    options: IngressOptions = {},
  ) {
    // ... existing constructor logic
  }

  private async handleLogLine(
    logLine: string,
    serverAddress: string,
    serverPort: number,
  ): Promise<void> {
    try {
      if (!logLine.trim()) return

      const event = await this.processRawEvent(logLine.trim(), serverAddress, serverPort)

      if (event) {
        // Publish to RabbitMQ instead of EventBus
        await this.eventPublisher.publish(event)

        this.metrics.increment("ingress.events.published", {
          event_type: event.eventType,
          server_id: event.serverId,
        })
      }
    } catch (error) {
      this.logger.error("Error processing log line", { error })
      this.metrics.increment("ingress.events.failed")
    }
  }
}
```

### 6.2 Dependency Injection Setup

```typescript
// src/shared/infrastructure/queue/queue.module.ts
export class QueueModule {
  static async create(config: RabbitMQConfig, logger: ILogger): Promise<QueueModuleDependencies> {
    // Create RabbitMQ client
    const client = new RabbitMQClient(config, logger)
    await client.connect()

    // Create publisher
    const publisher = new EventPublisher(client, logger, metrics)

    // Create consumer
    const consumer = new EventConsumer(client, processor, logger, metrics)

    return {
      client,
      publisher,
      consumer,
    }
  }
}

// src/context.ts
export class ApplicationContext {
  private queueModule: QueueModuleDependencies | null = null

  async initialize(): Promise<void> {
    // ... existing initialization

    // Initialize queue module
    this.queueModule = await QueueModule.create(this.config.rabbitmq, this.logger)

    // Update ingress service to use queue publisher
    this.ingressService = new IngressService(
      this.logger,
      this.queueModule.publisher, // Instead of eventBus
      this.dependencies,
    )
  }
}
```

---

## 7. Migration Strategy

### Phase 1: Dual-Write (2 weeks)

```typescript
// Temporary adapter for dual-write
export class DualEventPublisher implements IEventPublisher {
  constructor(
    private readonly eventBus: IEventBus,
    private readonly queuePublisher: IEventPublisher,
    private readonly logger: ILogger,
  ) {}

  async publish<T extends BaseEvent>(event: T): Promise<void> {
    // Write to both systems
    await Promise.all([
      this.eventBus.emit(event),
      this.queuePublisher.publish(event).catch((err) => {
        this.logger.error("Queue publish failed, falling back to EventBus", { err })
      }),
    ])
  }
}
```

### Phase 2: Shadow Mode (1 week)

- Workers consume from RabbitMQ but don't process
- Compare queue messages with EventBus events
- Validate message integrity and ordering

### Phase 3: Gradual Cutover (2 weeks)

- Route specific event types to RabbitMQ
- Monitor performance and error rates
- Rollback capability per event type

### Phase 4: Complete Migration (1 week)

- Remove EventBus dependencies
- Clean up dual-write code
- Full production deployment

---

## 8. Testing Approach

### 8.1 Unit Tests

```typescript
// src/shared/infrastructure/queue/event-publisher.test.ts
describe("EventPublisher", () => {
  let publisher: EventPublisher
  let mockClient: MockQueueClient
  let mockChannel: MockQueueChannel

  beforeEach(() => {
    mockChannel = createMockChannel()
    mockClient = createMockClient({ channel: mockChannel })
    publisher = new EventPublisher(mockClient, logger, metrics)
  })

  describe("publish", () => {
    it("should publish player kill event with correct routing", async () => {
      const event = createPlayerKillEvent()

      await publisher.publish(event)

      expect(mockChannel.publish).toHaveBeenCalledWith(
        "hlstats.events",
        "player.kill",
        expect.any(Buffer),
        expect.objectContaining({
          persistent: true,
          priority: MessagePriority.HIGH,
          headers: expect.objectContaining({
            "x-event-type": EventType.PLAYER_KILL,
          }),
        }),
      )
    })

    it("should handle channel buffer full gracefully", async () => {
      mockChannel.publish.mockReturnValue(false)

      const event = createPlayerKillEvent()

      await expect(publisher.publish(event)).rejects.toThrow(QueuePublishError)
    })
  })
})
```

### 8.2 Integration Tests

```typescript
// src/tests/integration/queue-integration.test.ts
describe("RabbitMQ Integration", () => {
  let container: StartedTestContainer
  let client: RabbitMQClient

  beforeAll(async () => {
    container = await new GenericContainer("rabbitmq:3.13-management")
      .withExposedPorts(5672, 15672)
      .withEnvironment({
        RABBITMQ_DEFAULT_USER: "test",
        RABBITMQ_DEFAULT_PASS: "test",
      })
      .start()

    const config = {
      url: `amqp://test:test@localhost:${container.getMappedPort(5672)}`,
      // ... other config
    }

    client = new RabbitMQClient(config, logger)
    await client.connect()
  })

  afterAll(async () => {
    await client.disconnect()
    await container.stop()
  })

  it("should process events end-to-end", async () => {
    const publisher = new EventPublisher(client, logger, metrics)
    const consumer = new EventConsumer(client, processor, logger, metrics)

    await consumer.start()

    const event = createPlayerKillEvent()
    await publisher.publish(event)

    // Wait for processing
    await waitFor(() => {
      expect(processor.processEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
        }),
      )
    })
  })
})
```

---

## 9. Monitoring & Operations

### 9.1 Health Checks

```typescript
// src/shared/infrastructure/queue/queue-health.ts
export class QueueHealthCheck implements IHealthCheck {
  constructor(
    private readonly client: IQueueClient,
    private readonly config: QueueHealthConfig,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const checks = await Promise.all([
      this.checkConnection(),
      this.checkQueues(),
      this.checkConsumers(),
    ])

    const healthy = checks.every((c) => c.healthy)

    return {
      name: "rabbitmq",
      healthy,
      details: {
        connection: checks[0],
        queues: checks[1],
        consumers: checks[2],
      },
    }
  }

  private async checkConnection(): Promise<CheckResult> {
    try {
      const connected = this.client.isConnected()
      const stats = this.client.getConnectionStats()

      return {
        healthy: connected,
        details: {
          connected,
          heartbeats_sent: stats.heartbeatsSent,
          heartbeats_missed: stats.heartbeatsMissed,
        },
      }
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      }
    }
  }
}
```

### 9.2 Metrics

```typescript
// Prometheus metrics
export const queueMetrics = {
  messagesPublished: new Counter({
    name: "hlstats_queue_messages_published_total",
    help: "Total messages published to queue",
    labelNames: ["event_type", "routing_key", "status"],
  }),

  messagesConsumed: new Counter({
    name: "hlstats_queue_messages_consumed_total",
    help: "Total messages consumed from queue",
    labelNames: ["queue", "event_type", "status"],
  }),

  messageProcessingDuration: new Histogram({
    name: "hlstats_queue_message_processing_duration_seconds",
    help: "Message processing duration",
    labelNames: ["queue", "event_type", "status"],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  }),

  queueDepth: new Gauge({
    name: "hlstats_queue_depth",
    help: "Current queue depth",
    labelNames: ["queue"],
  }),
}
```

### 9.3 Docker Integration

```yaml
# docker-compose.yml addition
rabbitmq:
  image: rabbitmq:3.13-management-alpine
  container_name: hlstatsnext-rabbitmq
  hostname: hlstatsnext-rabbitmq
  environment:
    - RABBITMQ_DEFAULT_USER=hlstats
    - RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASSWORD:-hlstats}
    - RABBITMQ_DEFAULT_VHOST=hlstats
  volumes:
    - rabbitmq-data:/var/lib/rabbitmq
    - ./docker/rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
    - ./docker/rabbitmq/definitions.json:/etc/rabbitmq/definitions.json:ro
  ports:
    - "5672:5672" # AMQP
    - "15672:15672" # Management UI
  networks:
    - default
  healthcheck:
    test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 10s
  restart: unless-stopped

volumes:
  rabbitmq-data:
```

---

## 10. Performance Considerations

### 10.1 Configuration Tuning

```typescript
// Optimal settings for game event processing
export const RABBITMQ_CONFIG: RabbitMQConfig = {
  url: process.env.RABBITMQ_URL || "amqp://localhost",
  prefetchCount: 50, // Balance between throughput and memory
  heartbeatInterval: 60,
  connectionRetry: {
    maxAttempts: 10,
    initialDelay: 1000,
    maxDelay: 30000,
  },
  queues: {
    priority: {
      name: "hlstats.events.priority",
      bindings: ["player.kill", "player.suicide", "round.*"],
      options: {
        durable: true,
        autoDelete: false,
        messageTtl: 3600000, // 1 hour
        maxLength: 100000, // Prevent unbounded growth
      },
    },
    // ... other queues
  },
}
```

### 10.2 Performance Benchmarks

Expected performance targets:

- **Message throughput**: 10,000+ events/second
- **Processing latency**: < 50ms p99
- **Queue depth**: < 1,000 messages during peak
- **Worker CPU**: < 70% utilization
- **Memory usage**: < 512MB per worker

---

## Conclusion

This RabbitMQ integration provides the HLStatsNext daemon with:

1. **Reliability**: Persistent message storage and guaranteed delivery
2. **Scalability**: Horizontal scaling through worker pools
3. **Observability**: Native management UI and comprehensive metrics
4. **Flexibility**: Topic-based routing for future expansion
5. **Maintainability**: Clean architecture following established patterns

The phased migration approach ensures zero downtime and provides rollback capabilities at each stage. The implementation follows all architectural principles and TypeScript best practices established in the project.
