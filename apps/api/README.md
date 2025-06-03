# API Server

GraphQL API server for HLStatsNext built with GraphQL Yoga.

## Overview

This application provides:

- GraphQL API with type-safe schema
- Real-time subscriptions for live updates
- Database integration via `@repo/database`
- Authentication and authorization (Phase 3.1)
- Performance monitoring and logging

## Setup

1. Copy environment configuration:

```bash
cp env.example .env
```

2. Update environment variables with your configuration.

3. Ensure database is set up (from `@repo/database` package).

4. Start development server:

```bash
pnpm dev
```

## Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm check-types` - TypeScript type checking
- `pnpm lint` - ESLint code linting

## API Endpoints

- **GraphQL Endpoint**: `http://localhost:4000/graphql`
- **GraphiQL Interface**: `http://localhost:4000/graphql` (development only)

## Development Phases

### Phase 1.4: GraphQL API Foundation ✅

- [x] Set up GraphQL Yoga server
- [x] Basic schema with health check
- [x] Database context integration
- [ ] Implement core entity queries
- [ ] Add subscription support
- [ ] Error handling and validation

### Phase 2.1: Game Server Monitoring Daemon

- [ ] Real-time server status subscriptions
- [ ] Player statistics updates
- [ ] Game event streaming

### Phase 3.1: Authentication and Authorization System

- [ ] JWT-based authentication
- [ ] Role-based permissions
- [ ] Session management
- [ ] Audit logging

## Example Queries

```graphql
# Health check
query {
  health {
    status
    timestamp
    version
  }
}

# Hello world
query {
  hello
}
```

## Future Schema (Phase 1.4)

```graphql
# Player queries
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

# Server status
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

## Architecture

- **GraphQL Yoga**: Modern GraphQL server
- **Type Safety**: Full TypeScript integration
- **Database**: Prisma ORM via `@repo/database`
- **Real-time**: GraphQL subscriptions
- **Authentication**: JWT with role-based access
- **Monitoring**: Performance and health tracking
