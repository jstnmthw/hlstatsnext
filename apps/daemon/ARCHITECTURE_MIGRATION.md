# Daemon Architecture Migration

This document outlines the migration from the legacy layered architecture to the new modular architecture.

## Migration Summary

The daemon has been completely refactored from a layered architecture to a modular, domain-driven architecture that follows the established best practices.

### Before (Legacy Architecture)
```
src/
├── services/           # Services grouped by technical layer
│   ├── player/
│   ├── weapon/
│   ├── processor/
│   └── ingress/
├── types/common/       # All types in one location
└── utils/
```

### After (Modular Architecture)
```
src/
├── modules/            # Self-contained business domains
│   ├── player/
│   │   ├── player.service.ts
│   │   ├── player.repository.ts
│   │   ├── player.types.ts
│   │   └── handlers/
│   ├── match/
│   ├── weapon/
│   ├── ranking/
│   ├── action/
│   └── ingress/
├── shared/             # Cross-module utilities
│   ├── types/
│   ├── utils/
│   └── infrastructure/
├── config/             # Configuration
├── context.ts          # DI container
└── main.ts             # Application entry
```

## Key Improvements

### 1. **Separation of Concerns**
- **Before**: EventProcessorService handled both orchestration AND business logic
- **After**: EventProcessor only orchestrates, modules handle their own business logic

### 2. **Dependency Injection**
- **Before**: Manual service wiring with factory functions
- **After**: Clean DI container with interface-based dependencies

### 3. **Module Boundaries**
- **Before**: No clear boundaries, services could import anything
- **After**: ESLint-enforced module boundaries with private file conventions

### 4. **Type Organization**
- **Before**: 567-line events.ts file with all types
- **After**: Domain-specific types in their respective modules

### 5. **TurboRepo Optimization**
- **Before**: No consideration for JIT compilation
- **After**: Direct imports optimized for TurboRepo's JIT compilation

## Module Structure

Each module follows this pattern:

```
modules/[domain]/
├── [domain].service.ts     # Business logic
├── [domain].repository.ts  # Data access layer  
├── [domain].types.ts       # Domain-specific types
├── _[domain].internal.ts   # Private implementation (underscore prefix)
└── handlers/               # Event handlers
    └── [domain]-event.handler.ts
```

## Usage Examples

### Direct Module Imports
```typescript
// ✅ GOOD: Direct imports optimized for TurboRepo
import { PlayerService } from '@/modules/player/player.service'
import { MatchService } from '@/modules/match/match.service'
import type { PlayerStats } from '@/modules/player/player.types'

// ❌ BAD: Importing private files
import { internalHelper } from '@/modules/player/_player.internal'
```

### Dependency Injection
```typescript
// Get application context
const context = getAppContext()

// All services are properly wired with dependencies
await context.playerService.handlePlayerEvent(event)
await context.matchService.handleMatchEvent(event)
```

### Event Processing
```typescript
// Clean event orchestration
const processor = new EventProcessor(context)
await processor.processEvent(gameEvent)
```

## Migration Benefits

1. **Performance**: TurboRepo JIT-optimized with direct imports
2. **Maintainability**: Clear module boundaries and separation of concerns
3. **Testability**: Interface-based DI enables easy mocking
4. **Scalability**: New features can be added as isolated modules
5. **Architecture Compliance**: Follows established monorepo guidelines
6. **Developer Experience**: ESLint enforcement prevents architectural violations

## Backwards Compatibility

The public API remains the same through the `HLStatsDaemon` class. The main entry point (`index.ts`) delegates to the new modular implementation while maintaining the same interface.

## Testing the Migration

1. **Unit Tests**: Each module can be tested in isolation
2. **Integration Tests**: Use the DI container to wire real dependencies
3. **E2E Tests**: The main daemon class interface remains unchanged

## Next Steps

1. Migrate remaining legacy services as needed
2. Add more comprehensive event parsing to the ingress module  
3. Implement proper ranking/ELO calculations in the ranking module
4. Add performance monitoring and metrics collection