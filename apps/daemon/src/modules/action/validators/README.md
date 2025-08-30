# Action Validators

This directory contains validation utilities that reduce cyclomatic complexity in action handlers by extracting common validation patterns into reusable, testable components.

## Architecture Overview

The validation system follows the **Single Responsibility Principle** by breaking down complex validation logic into focused validators:

```
ActionService
├── ActionDefinitionValidator  → Validates action definitions
├── PlayerValidator           → Validates player existence & resolution
├── MapResolver              → Resolves current map context
└── Business Logic           → Core action processing
```

## Benefits

- **Reduced Cyclomatic Complexity**: Action handlers drop from CC=9 to CC=4-5
- **Improved Testability**: Each validator can be tested in isolation
- **Code Reusability**: Common validation patterns shared across handlers
- **Better Error Handling**: Centralized validation error messages
- **Enhanced Maintainability**: Changes to validation logic in one place

## Validators

### ActionDefinitionValidator

Handles action definition lookup and validation for different event types.

**Responsibility**: Ensures actions exist and are valid for specific event types (player, team, world)

**Key Methods**:

- `validatePlayerAction(game, actionCode, team?)`
- `validatePlayerPlayerAction(game, actionCode, team?)`
- `validateTeamAction(game, actionCode, team?)`
- `validateWorldAction(game, actionCode, team?)`

### PlayerValidator

Handles player existence validation and resolution.

**Responsibility**: Ensures players exist, with fallback resolution via metadata

**Key Methods**:

- `validateSinglePlayer(playerId, actionCode, meta?, game?)` - Single player with resolution
- `validateMultiplePlayers(playerIds, actionCode)` - Batch player validation
- `validatePlayerPair(playerId, victimId, actionCode)` - Two-player validation

### MapResolver

Handles current map resolution for action context using RCON service as single source of truth.

**Responsibility**: Gets real-time map data directly from game servers via RCON

**Key Methods**:

- `resolveCurrentMap(serverId)` - Get current map from RCON service

## Usage Pattern

```typescript
export class ActionService {
  private readonly actionDefinitionValidator: ActionDefinitionValidator
  private readonly playerValidator: PlayerValidator
  private readonly mapResolver: MapResolver

  constructor(repository, logger, playerService?, matchService?, rconService?) {
    this.actionDefinitionValidator = new ActionDefinitionValidator(repository, logger)
    this.playerValidator = new PlayerValidator(playerService, logger)
    this.mapResolver = new MapResolver(rconService) // Use RCON service for real-time map data
  }

  private async handlePlayerAction(event: ActionPlayerEvent): Promise<HandlerResult> {
    // 1. Validate action definition
    const actionValidation = await this.actionDefinitionValidator.validatePlayerAction(
      game,
      actionCode,
      team,
    )
    if (actionValidation.shouldEarlyReturn) {
      return actionValidation.earlyResult!
    }

    // 2. Validate player
    const playerValidation = await this.playerValidator.validateSinglePlayer(
      playerId,
      actionCode,
      meta,
      game,
    )
    if (playerValidation.shouldEarlyReturn) {
      return playerValidation.earlyResult!
    }

    // 3. Resolve map context
    const currentMap = await this.mapResolver.resolveCurrentMap(serverId)

    // 4. Business logic (significantly simplified)
    // ... core action processing
  }
}
```

## Design Principles

### Early Return Pattern

All validators follow a consistent early return pattern:

```typescript
interface ValidationResult {
  shouldEarlyReturn: boolean
  earlyResult?: HandlerResult
  // ... validator-specific data
}
```

This allows handlers to exit early with appropriate success/failure results without deep nesting.

### Dependency Injection

Validators receive their dependencies through constructor injection, making them testable and following SOLID principles.

### Error Handling

- Unknown actions return `{ success: true }` (graceful degradation)
- Missing players return `{ success: true }` with warning logs
- Validation failures are logged with context

## Testing

Each validator should be tested independently:

```typescript
describe("ActionDefinitionValidator", () => {
  let validator: ActionDefinitionValidator
  let mockRepository: IActionRepository
  let mockLogger: ILogger

  beforeEach(() => {
    mockRepository = createMockRepository()
    mockLogger = createMockLogger()
    validator = new ActionDefinitionValidator(mockRepository, mockLogger)
  })

  it("should validate player actions", async () => {
    // Test implementation
  })
})
```

## Migration Guide

When adding validation to new action handlers:

1. **Identify validation patterns** in your handler method
2. **Check if existing validators** can handle the pattern
3. **Extract to new validator** if pattern is unique and reusable
4. **Update handler** to use validator pattern
5. **Add tests** for the new validation logic

## Performance Considerations

- **Batch Operations**: PlayerValidator uses batch lookups where possible
- **Early Returns**: Validation failures return immediately without unnecessary processing
- **Real-time Data**: MapResolver uses RCON service for up-to-date map information
- **Memory**: Validators are created once per service instance

## Future Enhancements

- **Async Validation Pipeline**: Chain validators for complex scenarios
- **Validation Metrics**: Track validation performance and failure rates
- **Custom Validation Rules**: Plugin system for game-specific validation
- **Validation Caching**: Cache validation results for repeated operations
