# HLStatsNext API Server

The **HLStatsNext API Server** is a modular, type-safe GraphQL API built with [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server), [Pothos](https://pothos-graphql.dev/), and [Prisma](https://www.prisma.io/). It provides the real-time, flexible data layer for the HLStatsNext platform, powering all statistics, analytics, and server management features.

---

## Architecture Overview

- **GraphQL Yoga**: Modern, fast, and extensible GraphQL server.
- **Pothos**: Code-first GraphQL schema builder with full TypeScript safety.
- **Prisma**: Database ORM for type-safe data access and migrations.
- **Pothos Prisma Plugin**: Auto-generates GraphQL types and CRUD resolvers from your Prisma schema.
- **Codegen**: Uses [@pothos/plugin-prisma](https://pothos-graphql.dev/docs/plugins/prisma) and [@pothos/plugin-codegen](https://pothos-graphql.dev/docs/plugins/codegen) to generate types and schema artifacts automatically.
- **Modular Structure**: Business logic is organized into feature modules (see below).

---

## Development

Run these commands from the `apps/api` directory (or with workspace filter):

```bash
pnpm dev          # Start the API server in development mode (hot reload)
pnpm build        # Build for production
pnpm start        # Start the production server
pnpm lint         # Lint the codebase
pnpm check-types  # TypeScript type checking
pnpm test         # Run unit/integration tests
```

### GraphQL Schema & Code Generation

The API schema is defined using Pothos, with types and CRUD resolvers auto-generated from your Prisma schema. To keep everything in sync:

```bash
# 1. Update your Prisma schema (packages/db/prisma/schema.prisma)
# 2. Generate Prisma client/types:
pnpm --filter @repo/db db:generate

# 3. Generate Pothos GraphQL types and schema artifacts:
pnpm codegen
# (Runs @pothos/plugin-codegen to update types and schema.graphql)
```

- All generated types are strictly typed and used throughout resolvers and services.
- The GraphQL schema is modular, with each domain (e.g., player, server) exposing its own queries, mutations, and subscriptions.

---

## API Endpoints

- **GraphQL Endpoint:** `http://localhost:4000/graphql`
- **GraphiQL Interface:** `http://localhost:4000/graphql` (development only)
- **Health Check:** `http://localhost:4000/health`

---

## Example GraphQL Queries

```graphql
# Health check
query {
  health {
    status
    timestamp
    version
  }
}

# Player leaderboard
query {
  players(limit: 10, orderBy: { skill: desc }) {
    id
    name
    skill
    statistics {
      kills
      deaths
      score
    }
  }
}

# Real-time server status
subscription {
  serverStatus {
    id
    name
    playerCount
    maxPlayers
    map
  }
}
```

---

## Project Structure

```
apps/api/
├── src/
│   ├── modules/      # Business domains (player, server, match, etc.)
│   │   ├── player/
│   │   │   ├── index.ts          # Module public API
│   │   │   ├── player.service.ts # Business logic
│   │   │   ├── player.schema.ts  # Pothos schema & resolvers
│   │   │   ├── player.types.ts   # Domain types, DTOs
│   │   │   └── player.test.ts    # Co-located tests
│   │   └── ...
│   ├── shared/       # Code shared by multiple modules (types, utils)
│   ├── config/       # App configuration
│   ├── builder.ts    # Pothos builder (plugins, schema config)
│   ├── context.ts    # App context (DI, Prisma, services)
│   └── index.ts      # Application entry point
├── schema.graphql    # Generated GraphQL schema (do not edit manually)
├── codegen.ts        # Pothos codegen config
└── ...
```

- **Modules**: Each business domain is a self-contained module with its own service, schema, types, and tests. Only exports from `index.ts` are public.
- **Pothos Builder**: Centralizes plugin setup (Prisma, codegen, etc.) and schema composition.
- **Generated Artifacts**: `schema.graphql` and Pothos type files are auto-generated and should not be edited by hand.

---

## Notes

- All API logic is strictly typed and modular. Cross-module access is only via public APIs.
- For more on the modular architecture, see [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
- For shared development standards, see the root [`README.md`](../../README.md) and [`BEST_PRACTICES.md`](../../apps/daemon/docs/BEST_PRACTICES.md).
