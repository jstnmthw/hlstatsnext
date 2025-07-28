# Application Layer

The application layer contains the business logic and orchestration patterns for the HLStats Daemon. This layer implements domain-specific workflows, saga patterns for complex transactions, and event coordination logic.

## Design Patterns

### 1. Saga Pattern

**Directory**: `sagas/`

Sagas provide transactional consistency across multiple modules with compensation logic for failures:

```typescript
export class KillEventSaga extends BaseSaga {
  protected initializeSteps(): void {
    this.steps = [
      new PlayerKillStep(this.playerService, this.logger),
      new WeaponStatsStep(this.weaponService, this.logger),
      new MatchStatsStep(this.matchService, this.logger),
      new RankingUpdateStep(this.rankingService, this.logger),
    ]
  }

  async execute(event: BaseEvent): Promise<SagaExecutionResult> {
    // Execute steps with automatic compensation on failure
    return super.execute(event)
  }
}
```

**Key Benefits:**

- **Transactional Consistency**: Ensures data consistency across modules
- **Automatic Compensation**: Rolls back completed steps when later steps fail
- **Failure Isolation**: Prevents cascade failures across modules
- **Audit Trail**: Comprehensive logging of saga execution and compensation

### 2. Event Coordinator Pattern

**File**: `event-coordinator.ts`

Coordinates complex event processing that requires multiple steps or modules:

```typescript
export class SagaEventCoordinator implements IEventCoordinator {
  private sagas = new Map<EventType, BaseSaga>()

  registerSaga(eventType: EventType, saga: BaseSaga): void {
    this.sagas.set(eventType, saga)
  }

  async coordinate(event: BaseEvent): Promise<void> {
    const saga = this.sagas.get(event.eventType)
    if (saga) {
      await saga.execute(event)
    }
  }
}
```

**Use Cases:**

- Multi-module transactions (kill events affecting player, weapon, match, ranking)
- Complex business workflows
- Event orchestration with dependencies
- Failure recovery and compensation

### 3. Step Pattern

**Used in**: Saga implementations

Individual saga steps implement specific business operations:

```typescript
export class PlayerKillStep implements SagaStep {
  async execute(context: SagaContext): Promise<void> {
    const event = context.originalEvent as PlayerKillEvent
    const result = await this.playerService.handleKillEvent(event)

    // Store result for potential compensation
    context.data.playerKillResult = result
    context.data.playerKillProcessed = true
  }

  async compensate(context: SagaContext): Promise<void> {
    if (!context.data.playerKillProcessed) return

    const event = context.originalEvent as PlayerKillEvent
    await this.playerService.compensateKillEvent?.(event.data.killerId, event.data.victimId)
  }
}
```

**Features:**

- **Idempotency**: Steps can be safely retried
- **State Tracking**: Context preserves execution state
- **Compensation Logic**: Each step knows how to undo its operations
- **Error Isolation**: Step failures don't affect other steps directly

### 4. Saga Monitor Pattern

**File**: `sagas/saga.monitor.ts`

Provides observability and debugging capabilities for saga execution:

```typescript
export class SagaMonitor implements ISagaMonitor {
  onSagaStarted(sagaName: string, eventId: string): void {
    this.logger.debug(`Saga started: ${sagaName}`, { eventId })
  }

  onStepExecuted(sagaName: string, stepName: string, eventId: string): void {
    this.logger.debug(`Step completed: ${stepName}`, { sagaName, eventId })
  }

  onSagaCompleted(sagaName: string, result: SagaExecutionResult): void {
    this.logger.info(`Saga completed: ${sagaName}`, {
      duration: result.executionTimeMs,
      steps: result.completedSteps,
    })
  }

  onSagaFailed(sagaName: string, eventId: string, error: Error): void {
    this.logger.error(`Saga failed: ${sagaName}`, {
      eventId,
      error: error.message,
    })
  }
}
```

## Architecture

### Component Overview

```
Application Layer
├── sagas/
│   ├── saga.base.ts           # Base saga implementation
│   ├── saga.types.ts          # Saga interfaces and types
│   ├── saga.monitor.ts        # Saga observability
│   └── kill-event/
│       ├── kill-event.saga.ts # Kill event saga implementation
│       └── kill-event.saga.test.ts
└── event-coordinator.ts      # Event coordination logic
```

### Saga Execution Flow

1. **Event Arrives**: Event coordinator receives complex event
2. **Saga Selection**: Appropriate saga is selected based on event type
3. **Context Creation**: Saga context is created with event and correlation data
4. **Step Execution**: Steps are executed sequentially
5. **Success Path**: All steps complete successfully
6. **Failure Path**: If any step fails, compensation runs in reverse order
7. **Result**: Saga execution result is returned with metrics

### Transaction Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Kill Event Saga                          │
├─────────────────────────────────────────────────────────────┤
│ Step 1: Player Stats Update                                 │
│   - Update kill/death counts                                │
│   - Compensation: Revert stat changes                       │
├─────────────────────────────────────────────────────────────┤
│ Step 2: Weapon Statistics                                   │
│   - Update weapon usage stats                               │
│   - Compensation: Revert weapon stats                       │
├─────────────────────────────────────────────────────────────┤
│ Step 3: Match Statistics                                    │
│   - Update match/round stats                                │
│   - Compensation: Revert match stats                        │
├─────────────────────────────────────────────────────────────┤
│ Step 4: Ranking Update                                      │
│   - Calculate skill rating changes                          │
│   - Compensation: Restore previous ratings                  │
└─────────────────────────────────────────────────────────────┘
```

## Usage Guidelines

### Creating a New Saga

1. **Define Saga Class**:

```typescript
export class CustomEventSaga extends BaseSaga {
  readonly name = "CustomEventSaga"

  constructor(
    logger: ILogger,
    eventBus: IEventBus,
    private readonly customService: ICustomService,
    monitor?: ISagaMonitor,
  ) {
    super(logger, eventBus, monitor)
    this.initializeSteps()
  }

  protected initializeSteps(): void {
    this.steps = [
      new CustomStep1(this.customService, this.logger),
      new CustomStep2(this.customService, this.logger),
    ]
  }

  canHandle(event: BaseEvent): boolean {
    return event.eventType === EventType.CUSTOM_EVENT
  }
}
```

2. **Implement Saga Steps**:

```typescript
export class CustomStep1 implements SagaStep {
  readonly name = "CustomStep1"

  constructor(
    private readonly customService: ICustomService,
    private readonly logger: ILogger,
  ) {}

  async execute(context: SagaContext): Promise<void> {
    const event = context.originalEvent as CustomEvent

    // Execute business logic
    await this.customService.processCustomLogic(event)

    // Mark as processed for compensation
    context.data.customStep1Processed = true

    this.logger.debug("Custom step 1 completed", {
      eventId: context.eventId,
    })
  }

  async compensate(context: SagaContext): Promise<void> {
    if (!context.data.customStep1Processed) return

    try {
      const event = context.originalEvent as CustomEvent
      await this.customService.compensateCustomLogic?.(event)

      this.logger.debug("Custom step 1 compensated", {
        eventId: context.eventId,
      })
    } catch (error) {
      this.logger.error("Custom step 1 compensation failed", {
        eventId: context.eventId,
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't rethrow - compensation failures shouldn't stop other compensations
    }
  }
}
```

3. **Register Saga**:

```typescript
// In context.ts or application bootstrap
const customSaga = new CustomEventSaga(logger, eventBus, customService, sagaMonitor)
sagaCoordinator.registerSaga(EventType.CUSTOM_EVENT, customSaga)
```

### Adding Compensation Methods to Services

Services need to implement compensation methods for saga rollback:

```typescript
export interface ICustomService {
  // Normal operations
  processCustomLogic(event: CustomEvent): Promise<void>

  // Compensation operations (optional)
  compensateCustomLogic?(event: CustomEvent): Promise<void>
}

export class CustomService implements ICustomService {
  async processCustomLogic(event: CustomEvent): Promise<void> {
    // Store original state for compensation
    const originalState = await this.getState(event.data.entityId)

    // Perform operation
    await this.updateState(event.data.entityId, event.data.newState)

    // Store for potential rollback
    await this.storeCompensationData(event.correlationId, originalState)
  }

  async compensateCustomLogic(event: CustomEvent): Promise<void> {
    // Retrieve original state
    const originalState = await this.getCompensationData(event.correlationId)

    if (originalState) {
      // Restore original state
      await this.updateState(event.data.entityId, originalState)

      // Cleanup compensation data
      await this.deleteCompensationData(event.correlationId)
    }
  }
}
```

### Event Coordination

For events that don't require sagas but need coordination:

```typescript
export class SimpleEventCoordinator implements IEventCoordinator {
  async coordinate(event: BaseEvent): Promise<void> {
    switch (event.eventType) {
      case EventType.PLAYER_CONNECT:
        await this.handlePlayerConnect(event as PlayerConnectEvent)
        break
      case EventType.SERVER_SHUTDOWN:
        await this.handleServerShutdown(event)
        break
    }
  }

  private async handlePlayerConnect(event: PlayerConnectEvent): Promise<void> {
    // Simple coordination without saga complexity
    await Promise.all([
      this.playerService.handlePlayerEvent(event),
      this.matchService.updatePlayerCount(event.serverId, 1),
    ])
  }
}
```

## Maintenance

### Monitoring Saga Health

1. **Saga Execution Metrics**:

```typescript
// Monitor via saga monitor
const sagaMetrics = sagaMonitor.getMetrics()
console.log("Saga success rate:", sagaMetrics.successRate)
console.log("Average execution time:", sagaMetrics.averageExecutionTime)
```

2. **Compensation Frequency**:

```typescript
// Track compensation events
sagaMonitor.onCompensationStarted = (sagaName, eventId) => {
  compensationCounter.increment({ sagaName })
}
```

3. **Step Performance**:

```typescript
// Monitor individual step performance
const stepMetrics = sagaMonitor.getStepMetrics()
stepMetrics.forEach((step) => {
  if (step.averageTime > STEP_THRESHOLD) {
    logger.warn(`Slow step detected: ${step.name}`, { averageTime: step.averageTime })
  }
})
```

### Debugging Saga Issues

1. **Enable Detailed Logging**:

```typescript
const sagaMonitor = new SagaMonitor(logger, {
  logStepDetails: true,
  logCompensationDetails: true,
})
```

2. **Check Saga Context**:

```typescript
// In saga steps, log context state
this.logger.debug("Saga context state", {
  eventId: context.eventId,
  correlationId: context.correlationId,
  data: context.data,
})
```

3. **Compensation Audit Trail**:

```typescript
// Track which compensations were attempted
const compensationAudit = new Map<string, string[]>()

onCompensationAttempted(sagaName: string, stepName: string, eventId: string) {
  if (!compensationAudit.has(eventId)) {
    compensationAudit.set(eventId, [])
  }
  compensationAudit.get(eventId)!.push(`${sagaName}.${stepName}`)
}
```

### Performance Optimization

1. **Parallel Step Execution** (when safe):

```typescript
// For independent steps that can run in parallel
protected async executeStepsInParallel(
  steps: SagaStep[],
  context: SagaContext
): Promise<void> {
  await Promise.all(steps.map(step => step.execute(context)))
}
```

2. **Step Timeout Management**:

```typescript
async execute(context: SagaContext): Promise<void> {
  const timeoutMs = 30000 // 30 seconds

  await Promise.race([
    this.executeStep(context),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Step timeout')), timeoutMs)
    )
  ])
}
```

3. **Compensation Data Cleanup**:

```typescript
// Implement cleanup for old compensation data
async cleanupExpiredCompensationData(): Promise<void> {
  const expiredThreshold = Date.now() - (24 * 60 * 60 * 1000) // 24 hours
  await this.deleteCompensationDataOlderThan(expiredThreshold)
}
```

## Extension Points

### Custom Saga Types

1. **Define Saga Interface**:

```typescript
export interface ICustomSaga extends BaseSaga {
  readonly customProperty: string
  customMethod(): Promise<void>
}
```

2. **Implement Custom Base**:

```typescript
export abstract class CustomBaseSaga extends BaseSaga implements ICustomSaga {
  abstract readonly customProperty: string

  async customMethod(): Promise<void> {
    // Custom saga behavior
  }

  protected override async executeSteps(context: SagaContext): Promise<void> {
    // Custom execution logic
    await this.customMethod()
    await super.executeSteps(context)
  }
}
```

### Advanced Coordination Patterns

1. **Event Aggregation**:

```typescript
export class AggregatingCoordinator implements IEventCoordinator {
  private eventBuffer = new Map<string, BaseEvent[]>()

  async coordinate(event: BaseEvent): Promise<void> {
    const aggregationKey = this.getAggregationKey(event)

    if (!this.eventBuffer.has(aggregationKey)) {
      this.eventBuffer.set(aggregationKey, [])
      // Start aggregation timer
      setTimeout(() => this.processAggregatedEvents(aggregationKey), 1000)
    }

    this.eventBuffer.get(aggregationKey)!.push(event)
  }

  private async processAggregatedEvents(key: string): Promise<void> {
    const events = this.eventBuffer.get(key) || []
    await this.processBatch(events)
    this.eventBuffer.delete(key)
  }
}
```

2. **Conditional Saga Execution**:

```typescript
export class ConditionalSagaCoordinator extends SagaEventCoordinator {
  async coordinate(event: BaseEvent): Promise<void> {
    const saga = this.sagas.get(event.eventType)

    if (saga && (await this.shouldExecuteSaga(event, saga))) {
      await saga.execute(event)
    }
  }

  private async shouldExecuteSaga(event: BaseEvent, saga: BaseSaga): Promise<boolean> {
    // Custom logic to determine if saga should run
    return saga.canHandle(event) && (await this.checkPreconditions(event))
  }
}
```

## Testing

### Saga Testing

```typescript
describe("KillEventSaga", () => {
  let saga: KillEventSaga
  let mockServices: MockServices
  let mockMonitor: ISagaMonitor

  beforeEach(() => {
    mockServices = createMockServices()
    mockMonitor = createMockSagaMonitor()
    saga = new KillEventSaga(
      mockLogger,
      mockEventBus,
      mockServices.playerService,
      mockServices.weaponService,
      mockServices.matchService,
      mockServices.rankingService,
      mockMonitor,
    )
  })

  describe("Successful Execution", () => {
    it("should execute all steps successfully", async () => {
      const killEvent = createMockKillEvent()

      const result = await saga.execute(killEvent)

      expect(result.success).toBe(true)
      expect(result.completedSteps).toBe(4)
      expect(mockServices.playerService.handleKillEvent).toHaveBeenCalled()
      expect(mockServices.weaponService.handleWeaponEvent).toHaveBeenCalled()
    })
  })

  describe("Failure and Compensation", () => {
    it("should compensate completed steps when later step fails", async () => {
      // Setup: Make the 3rd step fail
      vi.mocked(mockServices.matchService.handleKillInMatch).mockRejectedValueOnce(
        new Error("Match service failed"),
      )

      const killEvent = createMockKillEvent()

      await expect(saga.execute(killEvent)).rejects.toThrow("Match service failed")

      // Verify compensation was called for completed steps (in reverse order)
      expect(mockServices.weaponService.compensateWeaponEvent).toHaveBeenCalled()
      expect(mockServices.playerService.compensateKillEvent).toHaveBeenCalled()
      expect(mockServices.matchService.compensateKillInMatch).not.toHaveBeenCalled()
    })
  })
})
```

### Step Testing

```typescript
describe("PlayerKillStep", () => {
  let step: PlayerKillStep
  let mockPlayerService: IPlayerService

  beforeEach(() => {
    mockPlayerService = createMockPlayerService()
    step = new PlayerKillStep(mockPlayerService, mockLogger)
  })

  it("should execute and mark context as processed", async () => {
    const context = createMockSagaContext()

    await step.execute(context)

    expect(mockPlayerService.handleKillEvent).toHaveBeenCalledWith(context.originalEvent)
    expect(context.data.playerKillProcessed).toBe(true)
  })

  it("should compensate only if processed", async () => {
    const context = createMockSagaContext()
    context.data.playerKillProcessed = true

    await step.compensate(context)

    expect(mockPlayerService.compensateKillEvent).toHaveBeenCalled()
  })

  it("should skip compensation if not processed", async () => {
    const context = createMockSagaContext()
    // Don't set playerKillProcessed

    await step.compensate(context)

    expect(mockPlayerService.compensateKillEvent).not.toHaveBeenCalled()
  })
})
```

### Integration Testing

```typescript
describe("Saga Integration", () => {
  let context: AppContext
  let sagaCoordinator: SagaEventCoordinator

  beforeEach(async () => {
    context = await createTestContext()
    sagaCoordinator = context.sagaCoordinator
  })

  it("should process kill events end-to-end", async () => {
    const killEvent = createRealKillEvent()

    // Publish event through the system
    await context.eventBus.publish(killEvent)

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Verify all expected changes occurred
    const player = await context.playerService.getPlayerStats(killEvent.data.killerId)
    expect(player.kills).toBe(1)

    const weapon = await context.weaponService.getWeaponStats(killEvent.data.weapon)
    expect(weapon.kills).toBe(1)
  })

  it("should handle saga failures gracefully", async () => {
    // Setup: Make weapon service fail
    vi.spyOn(context.weaponService, "handleWeaponEvent").mockRejectedValueOnce(
      new Error("Weapon service down"),
    )

    const killEvent = createRealKillEvent()

    // Should not throw, but should log error
    await expect(context.eventBus.publish(killEvent)).resolves.not.toThrow()

    // Verify compensation occurred
    const player = await context.playerService.getPlayerStats(killEvent.data.killerId)
    expect(player.kills).toBe(0) // Should be compensated back to 0
  })
})
```

## Best Practices

1. **Saga Design**:
   - Keep sagas focused on a single business transaction
   - Make steps idempotent and atomic
   - Always implement compensation logic
   - Use meaningful step names and logging

2. **Error Handling**:
   - Don't let compensation failures stop other compensations
   - Log all errors with sufficient context
   - Implement retry logic where appropriate
   - Use timeouts to prevent hanging sagas

3. **Performance**:
   - Keep saga steps as fast as possible
   - Use parallel execution when steps are independent
   - Clean up compensation data regularly
   - Monitor saga execution times

4. **Testing**:
   - Test both success and failure paths
   - Verify compensation logic thoroughly
   - Use integration tests for end-to-end validation
   - Mock external dependencies appropriately

5. **Observability**:
   - Implement comprehensive logging
   - Use correlation IDs throughout
   - Monitor saga metrics and alerts
   - Create dashboards for saga health

6. **Data Management**:
   - Store minimal data in saga context
   - Use correlation IDs for data lookup
   - Implement data cleanup strategies
   - Consider data retention policies
