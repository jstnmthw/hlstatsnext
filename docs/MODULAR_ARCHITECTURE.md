# Modular Architecture

The HLStatsNext monorepo contains multiple applications (API, web, daemon) that need a consistent and scalable project structure. The initial structure was a hybrid of layer-first (e.g., `src/services`, `src/types`) and feature-first (`src/player`, `src/server`). This ambiguity can make it difficult to locate related code, understand boundaries, and maintain a clean architecture as the project grows.

A clear, unified pattern is needed that aligns with modern best practices, feels familiar to developers with experience in frameworks like Nest.js, and can be adapted for both backend services and the Next.js frontend.

## Decision

We will adopt a **Module-Based Architecture** across the monorepo. The core principle is to group code by system boundary (module) rather than just by technical role (layer).

### Backend Structure (`apps/api`, `apps/daemon-v2`)

Backend applications will be organized as follows:

```
src/
├── modules/      # Contains all self-contained business domains
│   ├── player/
│   │   ├── index.ts          # Defines the module's public API
│   │   ├── player.service.ts # Business logic
│   │   ├── player.schema.ts  # GraphQL schema and resolvers (for API)
│   │   ├── player.types.ts   # Data structures (domain types, DTOs)
│   │   └── player.test.ts    # Co-located tests
│   └── ...
├── shared/       # Code shared by MULTIPLE modules
│   ├── types/
│   │   └── common.ts
│   └── utils/
├── config/       # Application configuration
├── builder.ts    # Global app infrastructure (e.g., Pothos builder)
├── context.ts    # Global app infrastructure (e.g., DI context)
└── index.ts      # Application entry point
```

**Key Principles:**

1.  **Public API via `index.ts`**: Each module **must** have an `index.ts` that explicitly exports what is available to the rest of the application (e.g., services, types). Files and functions not exported from `index.ts` are considered private to the module.
2.  **Strict Boundaries**: Modules must not import directly from other modules' internal files. All cross-module communication should happen via the services injected in `context.ts`.
3.  **`modules/` over `features/`**: We use the name `modules` to emphasize technical encapsulation and the concept of a public API, which aligns with patterns in Nest.js and other modern frameworks.
4.  **`shared/` Directory**: Code that is used by two or more modules (e.g., the `Result` type) must be placed in the `src/shared/` directory.

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

## Consequences

- **Improved Clarity**: A clear separation between business logic (`modules/`), application plumbing (root `src/` files), and shared code (`shared/`).
- **Enhanced Maintainability**: Code is easier to find, refactor, and test. Encapsulation reduces the risk of unintended side-effects from changes.
- **Developer Experience**: The pattern is familiar and intuitive, especially for developers with a background in Nest.js or similar frameworks.
- **Scalability**: Provides a robust foundation for adding new features without cluttering the codebase.
