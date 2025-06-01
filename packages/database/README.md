# @repo/database

Shared database package for HLStatsX Next.js application using Prisma ORM.

## Overview

This package provides:

- Prisma schema definition
- Generated TypeScript types
- Database client instance
- Seed data for development
- Database utilities and helpers

## Setup

1. Copy environment configuration:

```bash
cp env.example .env
```

2. Update the `DATABASE_URL` in `.env` with your MySQL credentials.

3. Generate Prisma client:

```bash
pnpm db:generate
```

## Scripts

- `pnpm db:generate` - Generate Prisma client from schema
- `pnpm db:push` - Push schema changes to database (development)
- `pnpm db:migrate` - Create and apply migrations (production)
- `pnpm db:studio` - Open Prisma Studio for database browsing
- `pnpm db:seed` - Seed database with development data

## Usage

```typescript
import { db } from "@repo/database";

// Query examples (will be available after schema is defined)
const players = await db.player.findMany();
const player = await db.player.findUnique({
  where: { steamId: "76561198000000000" },
});
```

## Development Phases

### Phase 1.3: Database Design and Prisma Setup

- [ ] Design modern database schema based on legacy analysis
- [ ] Create Prisma models for core entities
- [ ] Set up relationships and indexes
- [ ] Add seed data for development

### Phase 2.3: Data Import and Legacy Migration

- [ ] Create import scripts for legacy data
- [ ] Map legacy schema to modern schema
- [ ] Implement data validation and transformation
- [ ] Add verification tools

## Schema Design Principles

- **Consistent naming**: camelCase fields, singular table names
- **Proper relationships**: Foreign keys with cascade rules
- **Performance indexes**: Strategic indexing for common queries
- **Extensible structure**: Easy to add new game types and statistics
- **Legacy compatibility**: Import-friendly structure for data migration
