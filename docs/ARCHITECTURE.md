# Modular Architecture

The HLStatsNext monorepo contains multiple applications (API, web, daemon) that need a consistent and scalable project structure. A clear, unified pattern is needed that aligns with modern best practices, TurboRepo's just-in-time compilation, and can be adapted for both backend services and the Next.js frontend.

## Decision

We will adopt a **Module-Based Architecture** across the monorepo. The core principle is to group code by system boundary (module) rather than just by technical role (layer), using direct imports optimized for TurboRepo's JIT compilation.

### Backend Structure (`apps/api`, `apps/daemon`)

Backend applications will be organized as follows:

```
src/
├── modules/      # Contains all self-contained business domains
│   ├── player/
│   │   ├── player.service.ts     # Business logic (public)
│   │   ├── player.repository.ts  # Data access layer (public)
│   │   ├── player.schema.ts      # GraphQL schema and resolvers (for API)
│   │   ├── player.types.ts       # Data structures (domain types, DTOs)
│   │   ├── _player.utils.ts      # Private utilities (underscore prefix)
│   │   ├── _player.internal.ts   # Private implementation details
│   │   └── handlers/
│   │       └── player-event.handler.ts
│   └── ...
├── shared/       # Code shared by MULTIPLE modules
│   ├── types/
│   │   ├── events.ts         # Base event interfaces
│   │   ├── common.ts         # Shared types
│   │   └── database.ts       # Database result types
│   ├── utils/
│   │   ├── logger.ts
│   │   └── validation.ts
│   └── infrastructure/
│       ├── event-processor.ts    # Event orchestration
│       └── repository.base.ts
├── config/       # Application configuration
├── context.ts    # Dependency injection container
├── builder.ts    # Global app infrastructure (e.g., Pothos builder)
└── index.ts      # Application entry point
```

**Key Principles:**

1.  **Direct Imports (TurboRepo Optimized)**: Import files directly using path mapping. No `index.ts` re-exports to maintain fast JIT compilation and hot reload performance.
2.  **Private Files Convention**: Files prefixed with underscore (`_`) are considered private to the module and should not be imported by other modules.
3.  **Strict Boundaries via Tooling**: ESLint rules enforce that modules cannot import private files from other modules. Cross-module communication happens via public service files and dependency injection.
4.  **`modules/` over `features/`**: We use the name `modules` to emphasize technical encapsulation and clear domain boundaries.
5.  **`shared/` Directory**: Code that is used by two or more modules (e.g., base types, utilities) must be placed in the `src/shared/` directory.

### Frontend Structure (`apps/web`)

The Next.js application will use a hybrid approach that respects the App Router's conventions while organizing UI and logic by feature.

```
apps/web/
├── app/          # NEXT.JS APP ROUTER (thin routes)
│   └── players/
│       └── [id]/page.tsx
├── features/     # Feature-based UI and logic
│   ├── player/
│   │   ├── components/
│   │   │   └── PlayerProfile.tsx
│   │   ├── hooks/
│   │   └── actions.ts
│   └── ...
├── lib/          # Shared utilities and types
└── components/ui # Global, stateless UI components
```

### Import Patterns

```typescript
// ✅ GOOD: Direct imports with TypeScript path mapping
import { PlayerService } from "@/modules/player/player.service"
import { MatchService } from "@/modules/match/match.service"
import type { PlayerStats } from "@/modules/player/player.types"
import { logger } from "@/shared/utils/logger.types"

// ❌ BAD: Importing private files (ESLint will catch this)
import { internalHelper } from "@/modules/player/_player.internal"

// ❌ BAD: Index.ts re-exports (slower compilation)
import { PlayerService } from "@/modules/player"
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": "src",
    "paths": {
      "@/modules/*": ["modules/*"],
      "@/shared/*": ["shared/*"],
      "@/config/*": ["config/*"]
    }
  }
}
```

### ESLint Boundary Enforcement

```javascript
// eslint.config.js
{
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/modules/**/_*'],
            message: 'Private module files (prefixed with _) cannot be imported across module boundaries'
          }
        ]
      }
    ]
  }
}
```

## Consequences

- **TurboRepo Optimized**: Direct imports work seamlessly with JIT compilation and hot reload for maximum development speed.
- **Improved Clarity**: A clear separation between business logic (`modules/`), application plumbing (root `src/` files), and shared code (`shared/`).
- **Enhanced Maintainability**: Code is easier to find, refactor, and test. Private file conventions reduce unintended coupling.
- **Build Performance**: No re-export overhead improves TypeScript compilation speed and tree-shaking efficiency.
- **Developer Experience**: Clear import patterns with tooling enforcement prevent architectural violations.
- **Scalability**: Provides a robust foundation for adding new features without cluttering the codebase.
