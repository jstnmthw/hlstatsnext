# Infrastructure Layer

The infrastructure layer provides the foundational building blocks for the HLStats Daemon's queue-first event-driven architecture. This layer implements core patterns and services that support the application layer's business logic.

## Design Patterns

### 1. Queue-First Event Processing

**File**: `messaging/queue/`

RabbitMQ-based event processing provides reliable message handling:

```typescript
// Publishing events to queue
await queuePublisher.publish(event)

// Queue consumer processes events through module handlers
const consumer = new RabbitMQConsumer(client, logger, moduleRegistry, coordinators)
await consumer.start()
```

**Key Features:**

- Persistent message storage
- Automatic retry logic with exponential backoff
- Dead letter queue handling
- Comprehensive metrics and monitoring

### 2. Simplified Module Event Handler Pattern

**File**: `modules/event-handler.base.ts`

Provides a clean foundation for all module event handlers:

```typescript
export class PlayerEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly playerService: IPlayerService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
  }

  async handleEvent(event: BaseEvent): Promise<void> {
    await this.playerService.handlePlayerEvent(event)
  }
}
```

**Benefits:**

- Simple, focused design without unnecessary abstractions
- Built-in error handling and metrics
- Standardized logging patterns
- Type-safe event processing

### 3. Repository Base Pattern

**File**: `repository.base.ts`

Provides common database operations and connection management:

```typescript
export class PlayerRepository extends BaseRepository {
  async findById(playerId: number): Promise<Player | null> {
    return client.player.findUnique({
      where: { playerId: data.playerId },
    })
  }

  async create(data: PlayerCreateData): Promise<Player> {
    return client.player.create({
      data: {
        lastName: data.lastName,
        game: data.game,
        skill: data.skill || 1000,
        uniqueIds: {
          create: {
            uniqueId: data.steamId,
            game: data.game,
          },
        },
      },
    })
  }
}
```

**Features:**

- Transaction management
- Connection pooling
- Query optimization
- Error handling and logging

### 4. Module Registry Pattern

**File**: `module-registry.ts`

Centralized registration and lifecycle management for module handlers:

```typescript
const registry = new ModuleRegistry(logger)

registry.register({
  name: "player",
  handler: playerEventHandler,
  handledEvents: [EventType.PLAYER_CONNECT, EventType.PLAYER_DISCONNECT],
})

await registry.initializeAll()
```

**Purpose:**

- Centralized module management
- Dependency injection
- Lifecycle coordination
- Health monitoring

### 5. Event Metrics Pattern

**File**: `event-metrics.ts`

Comprehensive performance and error tracking:

```typescript
const metrics = new EventMetrics(logger)

// Record processing time
metrics.recordProcessingTime(EventType.PLAYER_KILL, 150, "player-module")

// Record errors
metrics.recordError(EventType.PLAYER_KILL, error, "player-module")

// Get metrics
const summary = metrics.getMetrics()
```

**Metrics Collected:**

- Processing times (avg, min, max)
- Error rates and types
- Module-specific performance
- Event type statistics

### 6. Real Consumer Metrics

The real RabbitMQ consumer provides periodic INFO-level metrics for throughput and health.

## Architecture

### Component Overview

```
Infrastructure Layer
├── messaging/
│   ├── queue/              # RabbitMQ integration
│   ├── (migration/)        # Shadow consumer removed
│   └── module.ts          # Queue module configuration
├── modules/
│   ├── registry.ts        # Module lifecycle management
│   └── event-handler.base.ts  # Handler foundation
├── observability/
│   └── event-metrics.ts   # Performance monitoring
└── persistence/
    └── repository.base.ts # Database abstraction
```

### Event Flow

1. **Event Ingestion**: Events enter through the ingress service
2. **Queue Publishing**: Events are published directly to RabbitMQ queues
3. **Queue Processing**: RabbitMQ consumer processes events through module handlers
4. **Module Processing**: Each module processes relevant events independently
5. **Coordinator Processing**: Cross-module concerns handled by coordinators (minimal)
6. **Metrics Collection**: Performance and error metrics are recorded

### Real Queue Consumer Metrics

The real RabbitMQ consumer now logs periodic metrics similar to the Shadow Consumer. This helps monitor live processing throughput and health.

Example output (every 30s by default):

```
[2025-08-09 17:27:39] [ INFO ] Queue Consumer Metrics:
[2025-08-09 17:27:39] [ INFO ]   Events Received: 14
[2025-08-09 17:27:39] [ INFO ]   Events Processed: 14
[2025-08-09 17:27:39] [ INFO ]   Validation Errors: 0
[2025-08-09 17:27:39] [ INFO ]   Events/sec: 0.21
[2025-08-09 17:27:39] [ INFO ]   Queue hlstats.events.priority: 4 received, 4 processed, 0 errors
[2025-08-09 17:27:39] [ INFO ]   Queue hlstats.events.standard: 9 received, 9 processed, 0 errors
[2025-08-09 17:27:39] [ INFO ]   Queue hlstats.events.bulk: 1 received, 1 processed, 0 errors
```

Configuration is controlled via the consumer config (`logMetrics`, `metricsInterval` ms). Defaults: enabled, 30000ms.

### Database Layer

The infrastructure provides a robust database abstraction:

- **Connection Management**: Automatic pooling and reconnection
- **Transaction Support**: ACID compliance with rollback capabilities
- **Query Optimization**: Prepared statements and caching
- **Error Handling**: Comprehensive error recovery and logging

## Usage Guidelines

### Creating a New Module Handler

1. **Extend Base Handler**:

```typescript
export class WeaponEventHandler extends BaseModuleEventHandler {
  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    private readonly weaponService: IWeaponService,
    metrics?: EventMetrics,
  ) {
    super(eventBus, logger, metrics)
    this.registerEventHandlers()
  }

  registerEventHandlers(): void {
    this.registerHandler(EventType.WEAPON_FIRE, this.handleWeaponFire.bind(this))
  }

  private async handleWeaponFire(event: WeaponFireEvent): Promise<void> {
    await this.weaponService.handleWeaponEvent(event)
  }
}
```

2. **Register with Module Registry**:

```typescript
moduleRegistry.register({
  name: "weapon",
  handler: weaponEventHandler,
  handledEvents: [EventType.WEAPON_FIRE, EventType.WEAPON_HIT],
})
```

### Adding New Repository

1. **Extend Base Repository**:

```typescript
export class WeaponRepository extends BaseRepository {
  async updateWeaponStats(weaponCode: string, updates: Record<string, unknown>): Promise<void> {
    await this.update("weapons", { weapon_code: weaponCode }, updates)
  }
}
```

2. **Use in Service Layer**:

```typescript
export class WeaponService {
  constructor(
    private readonly repository: WeaponRepository,
    private readonly logger: ILogger,
  ) {}
}
```

### Integrating RabbitMQ

1. **Configure Queue Module**:

```typescript
const queueModule = new QueueModule(
  {
    rabbitmq: rabbitmqConfig,
    autoStartConsumers: true,
    dualPublisher: {
      enableQueue: true,
      enableEventBus: true,
      gracefulFallback: true,
    },
  },
  logger,
)
```

2. **Create Dual Publisher**:

```typescript
await queueModule.initialize()
const dualPublisher = queueModule.createDualPublisher(eventBus)
```

## Maintenance

### Monitoring

1. **Event Metrics**: Monitor processing times and error rates
2. **Module Health**: Check module registration and initialization
3. **Queue Status**: Monitor RabbitMQ connection and message flow
4. **Database Performance**: Track query times and connection pool usage

### Debugging

1. **Enable Debug Logging**:

```typescript
logger.setLogLevel(LogLevel.DEBUG)
```

2. **Check Module Registry**:

```typescript
const modules = moduleRegistry.getRegisteredModules()
```

3. **Review Event Metrics**:

```typescript
const metrics = eventMetrics.getMetrics()
console.log(metrics)
```

### Performance Tuning

1. **Database Optimization**:
   - Monitor slow queries
   - Optimize connection pool size
   - Use appropriate indexes

2. **Event Processing**:
   - Monitor event handler performance
   - Optimize batch processing
   - Consider event prioritization

3. **Queue Management**:
   - Monitor queue depths
   - Adjust consumer concurrency
   - Optimize message routing

## Extension Points

### Adding New Infrastructure Components

1. **Create Base Interface**:

```typescript
export interface INewComponent {
  initialize(): Promise<void>
  process(data: unknown): Promise<void>
  shutdown(): Promise<void>
}
```

2. **Implement Base Class**:

```typescript
export abstract class BaseNewComponent implements INewComponent {
  protected abstract processInternal(data: unknown): Promise<void>

  async process(data: unknown): Promise<void> {
    try {
      await this.processInternal(data)
    } catch (error) {
      this.logger.error("Processing failed", { error })
      throw error
    }
  }
}
```

3. **Register with Context**:

```typescript
// In context.ts
const newComponent = new ConcreteNewComponent(dependencies)
return { ...context, newComponent }
```

### Custom Event Types

1. **Define Event Interface**:

```typescript
export interface CustomEvent extends BaseEvent {
  eventType: EventType.CUSTOM_EVENT
  data: {
    customField: string
    // ... other fields
  }
}
```

2. **Add to Event Types**:

```typescript
export enum EventType {
  // ... existing events
  CUSTOM_EVENT = "CUSTOM_EVENT",
}
```

3. **Create Handler**:

```typescript
registerHandler(EventType.CUSTOM_EVENT, this.handleCustomEvent.bind(this))
```

## Testing

### Unit Testing Infrastructure Components

```typescript
describe("EventBus", () => {
  let eventBus: EventBus
  let mockLogger: ILogger

  beforeEach(() => {
    mockLogger = createMockLogger()
    eventBus = new EventBus(mockLogger)
  })

  it("should publish and handle events", async () => {
    const handler = vi.fn()
    const handlerId = eventBus.subscribe(EventType.PLAYER_KILL, handler)

    const event = createMockEvent(EventType.PLAYER_KILL)
    await eventBus.publish(event)

    expect(handler).toHaveBeenCalledWith(event)
  })
})
```

### Integration Testing

```typescript
describe("Module Integration", () => {
  let context: AppContext

  beforeEach(async () => {
    context = createTestContext()
    await context.moduleRegistry.initializeAll()
  })

  it("should process events end-to-end", async () => {
    const event = createPlayerKillEvent()
    await context.eventBus.publish(event)

    // Assert expected side effects
    expect(mockPlayerService.handleKillEvent).toHaveBeenCalled()
  })
})
```

### Performance Testing

```typescript
describe("Event Processing Performance", () => {
  it("should handle high event volume", async () => {
    const events = Array(1000)
      .fill(null)
      .map(() => createMockEvent())
    const startTime = Date.now()

    await Promise.all(events.map((event) => eventBus.publish(event)))

    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(5000) // 5 seconds max
  })
})
```

## Best Practices

1. **Error Handling**: Always wrap operations in try-catch blocks
2. **Logging**: Use structured logging with context objects
3. **Metrics**: Record performance metrics for all critical operations
4. **Type Safety**: Use TypeScript interfaces for all public APIs
5. **Testing**: Maintain high test coverage for infrastructure components
6. **Documentation**: Document all public interfaces and design decisions
7. **Performance**: Monitor and optimize critical paths regularly
8. **Security**: Validate all inputs and sanitize outputs
