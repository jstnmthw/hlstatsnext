# Phase 3: Contextual Logging Implementation Plan

## Overview

Implement contextual logging throughout the daemon application to improve observability, debugging, and traceability. Each log entry will carry correlation IDs and server IDs to enable tracing requests through the entire lifecycle.

## Goals

1. Replace direct logger usage with contextual loggers carrying correlationId/serverId
2. Ensure correlation IDs flow through the entire request lifecycle
3. Maintain backward compatibility with existing logging
4. Improve debugging and observability capabilities

## Implementation Strategy

### Step 1: Create Contextual Logger Abstraction

**Files to create:**

- `/shared/infrastructure/logging/contextual-logger.interface.ts`
- `/shared/infrastructure/logging/contextual-logger.ts`
- `/shared/infrastructure/logging/logger-context.types.ts`

**Key Components:**

```typescript
interface ILoggerContext {
  correlationId?: string
  serverId?: number
  playerId?: number
  sessionId?: string
  userId?: string
  traceId?: string
}

interface IContextualLogger extends ILogger {
  withContext(context: Partial<ILoggerContext>): IContextualLogger
  child(additionalContext: Partial<ILoggerContext>): IContextualLogger
}
```

### Step 2: Update Service Constructors

**Services to update:**

- ActionService
- PlayerService
- MatchService
- IngressService
- All parser classes (CsParser, etc.)

**Pattern:**

- Replace `ILogger` parameters with `IContextualLogger`
- Create child loggers with relevant context in methods
- Pass context down to called services

### Step 3: Context Flow Implementation

**Entry Points:**

1. **UDP Server**: Generate correlationId for incoming log lines
2. **Queue Consumers**: Extract correlationId from message headers
3. **HTTP Endpoints**: Generate correlationId for API requests

**Context Propagation:**

- Parser → Service → Repository chain
- Event publishing with context headers
- Database operations with correlation context

### Step 4: Integration Points

**Message Utils Integration:**

- Use injected UUID service for correlationId generation
- Add context to generated message IDs
- Include correlation context in queue message headers

**Database Logging:**

- Add correlationId to action logging methods
- Include serverId context in all database operations
- Optional: Add correlation tracking table

### Step 5: Testing Updates

**Test Infrastructure:**

- Create mock contextual logger
- Update all service tests to use contextual logger
- Verify context propagation in integration tests
- Add specific tests for correlation ID flow

## Implementation Details

### Contextual Logger Implementation

```typescript
export class ContextualLogger implements IContextualLogger {
  constructor(
    private readonly baseLogger: ILogger,
    private readonly context: ILoggerContext = {},
  ) {}

  withContext(context: Partial<ILoggerContext>): IContextualLogger {
    return new ContextualLogger(this.baseLogger, { ...this.context, ...context })
  }

  child(additionalContext: Partial<ILoggerContext>): IContextualLogger {
    return this.withContext(additionalContext)
  }

  private formatMessage(message: string): string {
    const contextParts: string[] = []
    if (this.context.correlationId) contextParts.push(`[${this.context.correlationId}]`)
    if (this.context.serverId) contextParts.push(`[srv:${this.context.serverId}]`)
    if (this.context.playerId) contextParts.push(`[player:${this.context.playerId}]`)

    return contextParts.length > 0 ? `${contextParts.join("")} ${message}` : message
  }

  info(message: string): void {
    this.baseLogger.info(this.formatMessage(message))
  }

  // ... other methods
}
```

### Service Integration Pattern

```typescript
// Before
export class ActionService {
  constructor(
    private readonly logger: ILogger,
    // ... other deps
  ) {}

  async handleActionEvent(event: ActionEvent): Promise<HandlerResult> {
    this.logger.info(`Processing action: ${event.data.actionCode}`)
    // ...
  }
}

// After
export class ActionService {
  constructor(
    private readonly logger: IContextualLogger,
    // ... other deps
  ) {}

  async handleActionEvent(event: ActionEvent): Promise<HandlerResult> {
    const contextualLogger = this.logger.withContext({
      correlationId: event.correlationId,
      serverId: event.serverId,
    })

    contextualLogger.info(`Processing action: ${event.data.actionCode}`)
    // Pass contextual logger to called services
    // ...
  }
}
```

## Benefits

1. **Enhanced Debugging**: Trace requests across service boundaries
2. **Better Observability**: Correlate logs by server, player, or session
3. **Improved Monitoring**: Group related operations for analysis
4. **Cleaner Logs**: Consistent context formatting across all services
5. **Future-Proof**: Foundation for distributed tracing systems

## Implementation Order

1. Create core abstractions and interfaces
2. Update message-utils and UUID service integration
3. Refactor services starting with high-level ones (ActionService)
4. Update parsers and low-level services
5. Update tests and validation
6. Integration testing and verification

## Success Criteria

- All services use contextual logging
- Correlation IDs flow through entire request lifecycle
- Log messages include relevant context (server, player, correlation)
- Tests verify context propagation
- Performance impact is minimal (<5% overhead)
- Backward compatibility maintained for existing logs

## Technical Considerations

- **Performance**: Lazy context formatting to minimize overhead
- **Memory**: Reuse logger instances where possible
- **Thread Safety**: Ensure context isolation in concurrent scenarios
- **Configuration**: Allow context fields to be configurable per environment
- **Integration**: Seamless integration with existing Pino logger infrastructure
