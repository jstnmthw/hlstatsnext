# Validation Patterns Guide

This guide documents the validation patterns implemented in the daemon to reduce cyclomatic complexity and improve code maintainability.

## Overview

The validation system extracts common validation logic into reusable validators following SOLID principles:

- **Single Responsibility**: Each validator handles one concern
- **Open/Closed**: Extensible without modifying existing code
- **Liskov Substitution**: Validators can be substituted/mocked for testing
- **Interface Segregation**: Focused interfaces for specific validation needs
- **Dependency Inversion**: Depend on abstractions, not concretions

## Problem Statement

### Before Refactoring

```typescript
private async handlePlayerAction(event: ActionPlayerEvent): Promise<HandlerResult> {
  try {
    let { playerId } = event.data
    const { actionCode, game, team, bonus } = event.data

    // ACTION DEFINITION VALIDATION (CC +2)
    const actionDef = await this.repository.findActionByCode(game, actionCode, team)
    if (!actionDef) {
      this.logger.warn(`Unknown action code: ${actionCode} for game ${game}`)
      return { success: true }
    }
    if (!actionDef.forPlayerActions) {
      return { success: true }
    }

    // PLAYER VALIDATION (CC +4)
    if (this.playerService) {
      const existing = await this.playerService.getPlayerStats(playerId)
      if (!existing) {
        const meta = event.meta as { steamId?: string; playerName?: string } | undefined
        if (meta?.steamId && meta.playerName) {
          try {
            const resolvedId = await this.playerService.getOrCreatePlayer(
              meta.steamId, meta.playerName, game
            )
            playerId = resolvedId
          } catch {
            this.logger.warn(`Player ${playerId} not found and could not be resolved`)
            return { success: true }
          }
        } else {
          this.logger.warn(`Player ${playerId} not found`)
          return { success: true }
        }
      }
    }

    // MAP RESOLUTION (CC +2)
    let currentMap = this.matchService?.getCurrentMap(event.serverId) || ""
    if (currentMap === "unknown" && this.matchService) {
      currentMap = await this.matchService.initializeMapForServer(event.serverId)
    }

    // Business logic...
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Total Cyclomatic Complexity: 9
```

### After Refactoring

```typescript
private async handlePlayerAction(event: ActionPlayerEvent): Promise<HandlerResult> {
  try {
    const { actionCode, game, team, bonus } = event.data

    // ACTION VALIDATION (CC +1)
    const actionValidation = await this.actionDefinitionValidator.validatePlayerAction(
      game, actionCode, team
    )
    if (actionValidation.shouldEarlyReturn) {
      return actionValidation.earlyResult!
    }
    const actionDef = actionValidation.actionDef!

    // PLAYER VALIDATION (CC +1)
    const playerValidation = await this.playerValidator.validateSinglePlayer(
      event.data.playerId, actionCode, event.meta, game
    )
    if (playerValidation.shouldEarlyReturn) {
      return playerValidation.earlyResult!
    }
    const playerId = playerValidation.playerId

    // MAP RESOLUTION (CC +0)
    const currentMap = await this.mapResolver.resolveCurrentMap(event.serverId)

    // Business logic...
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Total Cyclomatic Complexity: 4
```

## Validation Patterns

### 1. Early Return Pattern

All validators follow a consistent early return pattern to eliminate nested conditions:

```typescript
interface ValidationResult {
  shouldEarlyReturn: boolean
  earlyResult?: HandlerResult
  // ... validator-specific data
}

// Usage
const result = await validator.validateSomething(params)
if (result.shouldEarlyReturn) {
  return result.earlyResult! // Exit early with appropriate result
}
// Continue with business logic using validated data
```

**Benefits:**

- Eliminates deep nesting
- Consistent error handling
- Clear separation of validation and business logic

### 2. Graceful Degradation Pattern

Validators handle missing data gracefully without failing the entire operation:

```typescript
// Unknown actions don't fail the system
if (!actionDef) {
  this.logger.warn(`Unknown action code: ${actionCode}`)
  return { success: true } // Graceful degradation
}

// Missing players are logged but don't crash
if (!playerExists) {
  this.logger.warn(`Player ${playerId} not found`)
  return { success: true } // Continue processing
}
```

**Benefits:**

- System resilience
- Better user experience
- Easier debugging through logging

### 3. Batch Validation Pattern

For performance-critical operations, validators use batch lookups:

```typescript
// Instead of N individual queries
for (const playerId of playerIds) {
  const stats = await playerService.getPlayerStats(playerId)
}

// Use single batch query
const playerStats = await playerService.getPlayerStatsBatch(playerIds)
const validPlayerIds = playerIds.filter((id) => playerStats.has(id))
```

**Benefits:**

- Prevents N+1 queries
- Better database performance
- Reduced latency

### 4. Context Resolution Pattern

Validators resolve context information needed for business logic:

```typescript
// MAP CONTEXT
const currentMap = await mapResolver.resolveCurrentMap(serverId)
// Handles: getCurrentMap() → "unknown" → initializeMapForServer()

// PLAYER CONTEXT WITH RESOLUTION
const playerResult = await playerValidator.validateSinglePlayer(
  playerId,
  actionCode,
  metadata,
  game,
)
// Handles: getPlayerStats() → null → getOrCreatePlayer(metadata)
```

**Benefits:**

- Consistent context resolution
- Fallback handling
- Centralized resolution logic

## Implementation Guidelines

### Creating New Validators

When creating new validators, follow these patterns:

```typescript
export class NewValidator {
  constructor(
    private readonly dependencies: IDependency,
    private readonly logger: ILogger,
  ) {}

  async validate(params: ValidatorParams): Promise<ValidationResult> {
    // 1. Perform validation logic
    const validationData = await this.validateLogic(params)

    // 2. Handle negative cases with early return
    if (!validationData.isValid) {
      this.logger.warn(`Validation failed: ${validationData.reason}`)
      return {
        shouldEarlyReturn: true,
        earlyResult: { success: true }, // Graceful degradation
      }
    }

    // 3. Return success case with data
    return {
      shouldEarlyReturn: false,
      validatedData: validationData.result,
    }
  }
}
```

### Integration Pattern

Integrate validators into services following this pattern:

```typescript
export class SomeService {
  private readonly validator1: Validator1
  private readonly validator2: Validator2

  constructor(dependencies) {
    this.validator1 = new Validator1(dependency1, logger)
    this.validator2 = new Validator2(dependency2, logger)
  }

  async handleSomething(event: SomeEvent): Promise<HandlerResult> {
    // Validate in logical order
    const validation1 = await this.validator1.validate(event.data1)
    if (validation1.shouldEarlyReturn) return validation1.earlyResult!

    const validation2 = await this.validator2.validate(event.data2)
    if (validation2.shouldEarlyReturn) return validation2.earlyResult!

    // Business logic with validated data
    return this.processBusinessLogic(validation1.data, validation2.data)
  }
}
```

## Testing Patterns

### Validator Testing

Test validators independently for focused unit tests:

```typescript
describe("ActionDefinitionValidator", () => {
  let validator: ActionDefinitionValidator
  let mockRepository: MockActionRepository
  let mockLogger: MockLogger

  beforeEach(() => {
    mockRepository = createMockRepository()
    mockLogger = createMockLogger()
    validator = new ActionDefinitionValidator(mockRepository, mockLogger)
  })

  describe("validatePlayerAction", () => {
    it("should return early for unknown actions", async () => {
      mockRepository.findActionByCode.mockResolvedValue(null)

      const result = await validator.validatePlayerAction("game", "unknown", "team")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.earlyResult).toEqual({ success: true })
      expect(mockLogger.warn).toHaveBeenCalledWith("Unknown action code: unknown for game game")
    })

    it("should return early for invalid action type", async () => {
      mockRepository.findActionByCode.mockResolvedValue({
        id: 1,
        code: "test",
        forPlayerActions: false,
      })

      const result = await validator.validatePlayerAction("game", "test")

      expect(result.shouldEarlyReturn).toBe(true)
      expect(result.earlyResult).toEqual({ success: true })
    })

    it("should return action definition for valid actions", async () => {
      const actionDef = { id: 1, code: "kill", forPlayerActions: true }
      mockRepository.findActionByCode.mockResolvedValue(actionDef)

      const result = await validator.validatePlayerAction("game", "kill")

      expect(result.shouldEarlyReturn).toBe(false)
      expect(result.actionDef).toEqual(actionDef)
    })
  })
})
```

### Service Integration Testing

Test services with validators to ensure proper integration:

```typescript
describe("ActionService Integration", () => {
  it("should handle validation failures gracefully", async () => {
    mockRepository.findActionByCode.mockResolvedValue(null) // Unknown action

    const result = await actionService.handleActionEvent(playerActionEvent)

    expect(result.success).toBe(true) // Graceful degradation
    expect(mockLogger.warn).toHaveBeenCalledWith("Unknown action code: unknown for game cstrike")
  })
})
```

## Performance Considerations

### Validation Overhead

- **Validator instantiation**: Done once per service instance
- **Validation calls**: Minimal overhead due to early returns
- **Batch operations**: Reduce database queries significantly
- **Memory usage**: Validators are lightweight wrappers

### Optimization Strategies

1. **Cache validation results** for frequently accessed data
2. **Use batch operations** whenever possible
3. **Implement circuit breakers** for external service calls
4. **Profile validation hotpaths** and optimize accordingly

## Migration Checklist

When adding validation to existing handlers:

- [ ] Identify validation patterns in handler method
- [ ] Check if existing validators can handle the patterns
- [ ] Extract to new validator if pattern is reusable
- [ ] Update handler to use validator pattern
- [ ] Add unit tests for validator logic
- [ ] Add integration tests for handler
- [ ] Verify cyclomatic complexity reduction
- [ ] Update documentation

## Benefits Summary

### Code Quality

- **Reduced Complexity**: CC drops from 9+ to 4-5 range
- **Better Separation**: Validation vs. business logic
- **Increased Reusability**: Common patterns shared across handlers
- **Improved Testability**: Validators tested independently

### Performance

- **Batch Operations**: Prevent N+1 queries
- **Early Returns**: Exit fast on invalid data
- **Reduced Overhead**: Minimal validation cost

### Maintainability

- **Centralized Logic**: Validation rules in one place
- **Consistent Patterns**: Same validation approach everywhere
- **Easier Changes**: Update validation in single location
- **Better Documentation**: Clear validation contracts
