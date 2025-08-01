# Application Layer

The application layer contains the business logic and orchestration patterns for the HLStats Daemon. This layer implements domain-specific workflows and event coordination logic using a simplified queue-only architecture.

## Design Patterns

### 1. Simple Event Coordination

**File**: `event-coordinator.ts`

Event coordinators handle cross-module concerns that require orchestration beyond individual module handlers:

```typescript
export class KillEventCoordinator implements EventCoordinator {
  constructor(
    private readonly logger: ILogger,
    private readonly rankingService: IRankingService,
  ) {}

  async coordinateEvent(event: BaseEvent): Promise<void> {
    if (event.eventType !== EventType.PLAYER_KILL) {
      return
    }

    // Handle cross-module concerns like ranking updates
    await this.rankingService.handleRatingUpdate()
  }
}
```

**Key Benefits:**

- **Simplicity**: Direct coordination without complex transaction management  
- **Performance**: No overhead from saga state management
- **Maintainability**: Easy to understand and debug
- **Reliability**: Module handlers are responsible for their own consistency

**Current Architecture:**

- **Module Handlers**: Handle core business logic for their domain
- **Event Coordinators**: Handle cross-module concerns (currently minimal)
- **Queue Processing**: All events processed through RabbitMQ queues
- **No Compensation**: Simplified approach relying on module-level consistency

### 2. Module Handler Pattern

**Used throughout**: Module event handlers

Module handlers encapsulate domain-specific business logic:

```typescript
export class PlayerEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly playerService: IPlayerService,
    private readonly serverService: IServerService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
  }

  async handleEvent(event: BaseEvent): Promise<void> {
    const resolvedEvent = await this.resolvePlayerIds(event)
    await this.playerService.handlePlayerEvent(resolvedEvent)
  }
}
```

**Features:**

- **Domain Focus**: Each handler manages one business domain
- **Type Safety**: Strong typing with event-specific interfaces
- **Metrics Integration**: Built-in performance monitoring
- **Error Isolation**: Handler failures don't affect other modules

### 3. Queue-First Processing

**Architecture**: RabbitMQ-based event processing

All events are processed through RabbitMQ queues for reliability and scalability:

```typescript
export class RabbitMQEventProcessor implements IEventProcessor {
  async processEvent(event: BaseEvent): Promise<void> {
    // Process through module handlers first (business logic)
    await this.processModuleHandlers(event)

    // Then process through coordinators (cross-module concerns)
    await this.processCoordinators(event)
  }
}
```

**Benefits:**

- **Reliability**: Queue persistence ensures no event loss
- **Scalability**: Multiple consumers can process events in parallel
- **Observability**: Comprehensive metrics and logging
- **Simplicity**: No complex state management or compensation logic

## Architecture

### Component Overview

```
Application Layer
├── event-coordinator.ts          # Simple event coordination
└── event-coordinator.test.ts     # Coordinator tests
```

### Event Processing Flow

1. **Event Arrives**: RabbitMQ consumer receives event from queue
2. **Module Processing**: Event is processed by relevant module handlers
3. **Coordination**: Event is processed by any relevant coordinators
4. **Completion**: Event processing completes with metrics logging

### Processing Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Queue Event Processing                   │
├─────────────────────────────────────────────────────────────┤
│ Step 1: Module Handler Processing                           │
│   - PlayerService handles player-related logic             │
│   - WeaponService handles weapon statistics                 │
│   - MatchService handles match/round statistics             │
├─────────────────────────────────────────────────────────────┤
│ Step 2: Coordinator Processing (if needed)                  │
│   - KillEventCoordinator handles cross-module concerns     │
│   - Currently only rating updates                          │
└─────────────────────────────────────────────────────────────┘
```

## Usage Guidelines

### Creating a New Coordinator

1. **Define Coordinator Class**:

```typescript
export class CustomEventCoordinator implements EventCoordinator {
  constructor(
    private readonly logger: ILogger,
    private readonly customService: ICustomService,
  ) {}

  async coordinateEvent(event: BaseEvent): Promise<void> {
    if (event.eventType !== EventType.CUSTOM_EVENT) {
      return
    }

    // Handle cross-module concerns
    await this.customService.handleCrossModuleConcern(event)
    
    this.logger.debug("Custom event coordinated", {
      eventId: event.eventId,
      eventType: event.eventType,
    })
  }
}
```

2. **Register Coordinator**:

```typescript
// In context.ts initialization
const coordinators: EventCoordinator[] = [
  new CustomEventCoordinator(logger, customService),
]

const rabbitmqConsumer = new RabbitMQConsumer(
  queueClient,
  logger,
  moduleRegistry,
  coordinators, // Pass coordinators here
)
```

### Module Handler Best Practices

Module handlers should focus on their domain's business logic:

```typescript
export class CustomEventHandler extends BaseModuleEventHandler {
  async handleEvent(event: BaseEvent): Promise<void> {
    // 1. Validate event type and data
    if (!this.canHandle(event)) {
      return
    }

    // 2. Process business logic
    await this.customService.processEvent(event)

    // 3. Update metrics (automatic via base class)
    this.metrics?.recordEventProcessed(event.eventType)
  }

  private canHandle(event: BaseEvent): boolean {
    return event.eventType === EventType.CUSTOM_EVENT
  }
}
```

## Maintenance

### Monitoring Event Processing

1. **Queue Metrics**:

```typescript
// Monitor queue health via RabbitMQ management
const queueMetrics = await rabbitmqClient.getQueueMetrics()
console.log("Queue depth:", queueMetrics.messageCount)
console.log("Consumer count:", queueMetrics.consumerCount)
```

2. **Handler Performance**:

```typescript
// Monitor via event metrics
const handlerMetrics = eventMetrics.getHandlerMetrics()
handlerMetrics.forEach((metric) => {
  if (metric.averageProcessingTime > THRESHOLD) {
    logger.warn(`Slow handler: ${metric.handlerName}`, {
      averageTime: metric.averageProcessingTime
    })
  }
})
```

3. **Error Rates**:

```typescript
// Track processing failures
eventMetrics.onProcessingError = (eventType, error) => {
  errorCounter.increment({ eventType, error: error.name })
}
```

### Debugging Event Issues

1. **Enable Detailed Logging**:

```typescript
// Set LOG_LEVEL=debug in environment
const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  enableQueueLogging: true, // Enable queue-specific logs
})
```

2. **Trace Event Flow**:

```typescript
// Events include correlation IDs for tracing
this.logger.info("Processing event", {
  eventId: event.eventId,
  correlationId: event.correlationId,
  eventType: event.eventType,
})
```

3. **Queue Message Inspection**:

```typescript
// Use shadow consumer for non-destructive message inspection
const shadowConsumer = new ShadowConsumer({
  logEvents: true, // Log all messages
  logParsingErrors: true, // Log parsing failures
})
```

### Performance Optimization

1. **Handler Optimization**:

```typescript
// Keep handlers lightweight and focused
export class OptimizedHandler extends BaseModuleEventHandler {
  async handleEvent(event: BaseEvent): Promise<void> {
    // Use bulk operations where possible
    await this.service.processBatch([event])
    
    // Avoid unnecessary database queries
    if (this.shouldSkipProcessing(event)) {
      return
    }
    
    await this.service.processEvent(event)
  }
}
```

2. **Queue Configuration**:

```typescript
// Optimize queue settings for throughput
const rabbitmqConfig = {
  prefetchCount: 10, // Process multiple messages at once
  maxRetries: 3, // Limit retry attempts
  retryDelay: 1000, // Exponential backoff
}
```

3. **Parallel Processing**:

```typescript
// Module handlers process in parallel automatically
const processingPromises = handlers.map(async (handler) => {
  await handler.handleEvent(event)
})
await Promise.all(processingPromises)
```

## Testing

### Coordinator Testing

```typescript
describe("KillEventCoordinator", () => {
  let coordinator: KillEventCoordinator
  let mockRankingService: IRankingService

  beforeEach(() => {
    mockRankingService = {
      handleRatingUpdate: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as IRankingService
    
    coordinator = new KillEventCoordinator(mockLogger, mockRankingService)
  })

  it("should handle kill events", async () => {
    const killEvent: BaseEvent = {
      eventType: EventType.PLAYER_KILL,
      serverId: 1,
      timestamp: new Date(),
      data: { killerId: 123, victimId: 456 },
    }

    await coordinator.coordinateEvent(killEvent)

    expect(mockRankingService.handleRatingUpdate).toHaveBeenCalledTimes(1)
  })

  it("should skip non-kill events", async () => {
    const connectEvent: BaseEvent = {
      eventType: EventType.PLAYER_CONNECT,
      serverId: 1,
      timestamp: new Date(),
      data: {},
    }

    await coordinator.coordinateEvent(connectEvent)

    expect(mockRankingService.handleRatingUpdate).not.toHaveBeenCalled()
  })
})
```

### Integration Testing

```typescript
describe("Event Processing Integration", () => {
  let context: AppContext
  let eventPublisher: IEventPublisher

  beforeEach(async () => {
    context = await createTestContext()
    eventPublisher = context.eventPublisher!
  })

  it("should process events end-to-end", async () => {
    const killEvent: BaseEvent = {
      eventType: EventType.PLAYER_KILL,
      serverId: 1,
      timestamp: new Date(),
      data: { killerId: 123, victimId: 456 },
    }

    // Publish to queue
    await eventPublisher.publish(killEvent)

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify processing occurred
    const playerStats = await context.playerService.getPlayerStats(123)
    expect(playerStats?.kills).toBeGreaterThan(0)
  })
})
```

## Best Practices

1. **Handler Design**:
   - Keep handlers focused on single business domains
   - Use strong typing for event data
   - Implement proper error handling
   - Log with correlation IDs

2. **Coordinator Usage**:
   - Only use coordinators for true cross-module concerns
   - Keep coordination logic simple and fast
   - Avoid complex state management
   - Prefer module-level consistency over distributed transactions

3. **Performance**:
   - Process events as quickly as possible
   - Use bulk operations where beneficial
   - Monitor queue depths and processing times
   - Implement circuit breakers for external dependencies

4. **Error Handling**:
   - Log errors with sufficient context
   - Implement retry logic with exponential backoff
   - Use dead letter queues for failed messages
   - Monitor error rates and alert on anomalies

5. **Testing**:
   - Test handlers in isolation with mocked dependencies
   - Use integration tests for end-to-end validation
   - Test error scenarios and retry logic
   - Verify queue message processing

6. **Observability**:
   - Use structured logging with correlation IDs
   - Implement comprehensive metrics collection
   - Set up alerting for critical failures
   - Create dashboards for system health monitoring

## Migration Notes

The daemon has been simplified from a complex saga-based architecture to a queue-only approach:

- **Removed**: Saga pattern, compensation logic, complex transaction management
- **Kept**: Event coordination for cross-module concerns, module handlers for business logic
- **Added**: Direct RabbitMQ queue processing, simplified error handling

This change reduces complexity while maintaining reliability through queue persistence and retry mechanisms.