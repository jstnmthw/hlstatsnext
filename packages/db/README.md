# @repo/db

Database package for HLStatsNext - provides Prisma client, types, and GraphQL integrations for game statistics tracking.

## Overview

This package provides:

- **Prisma ORM integration** - Type-safe database access with MySQL
- **Generated TypeScript types** - Full type safety for all database entities
- **Shared database client** - Centralized connection management
- **GraphQL schema generation** - Pothos types for the API layer
- **Development utilities** - Seeding, migrations, and database tools

Built for tracking Counter-Strike, Team Fortress, and other Source engine game statistics with support for players, clans, weapons, maps, and real-time events.

## Setup & Installation

### 1. Environment Configuration

Copy the environment template and configure your database:

```bash
# Copy template
cp env.example .env

# Edit with your MySQL credentials
DATABASE_URL="mysql://username:password@localhost:3306/hlstatsnext"
```

### 2. Database Initialization

```bash
# Generate Prisma client and types
pnpm db:generate

# Push schema to database (development)
pnpm db:push

# Seed with initial data (games, countries, etc.)
pnpm db:seed

# Build the package for consumption
pnpm build
```

### 3. Production Setup

For production environments:

```bash
# Create migration files
pnpm db:migrate

# Deploy migrations
pnpm db:migrate deploy
```

## Usage

### Basic Database Operations

```typescript
import { db } from "@repo/db/client"

// Find players by game
const tfPlayers = await db.player.findMany({
  where: { game: "tf" },
  include: {
    gameData: true,
    clanData: true,
    countryData: true,
  },
})

// Get top players by skill rating
const topPlayers = await db.player.findMany({
  where: { hideranking: 0 },
  orderBy: { skill: "desc" },
  take: 10,
  select: {
    playerId: true,
    lastName: true,
    skill: true,
    kills: true,
    deaths: true,
  },
})

// Player statistics with relationships
const playerStats = await db.player.findUnique({
  where: { playerId: 12345 },
  include: {
    clanData: { select: { name: true, tag: true } },
    countryData: { select: { name: true, flag: true } },
    awardsWonAsDWinner: { include: { award: true } },
    _count: {
      select: {
        fragsAsKiller: true,
        fragsAsVictim: true,
      },
    },
  },
})
```

### Game and Server Management

```typescript
// Get active servers with recent activity
const activeServers = await db.server.findMany({
  where: {
    hidden: 0,
    lastEvent: { gt: Math.floor(Date.now() / 1000) - 3600 }, // Last hour
  },
  include: {
    gameData: true,
    serverLoad: { orderBy: { timestamp: "desc" }, take: 1 },
  },
})

// Track weapon usage statistics
const weaponStats = await db.weapon.findMany({
  where: { game: "css" },
  include: {
    fragsAsWeapon: {
      where: { eventTime: { gt: Math.floor(Date.now() / 1000) - 86400 } },
      _count: true,
    },
  },
})
```

### Real-time Event Tracking

```typescript
// Record a player kill event
const killEvent = await db.eventFrag.create({
  data: {
    serverId: 1,
    attackerId: 123,
    victimId: 456,
    weapon: "ak47",
    headshot: 1,
    eventTime: Math.floor(Date.now() / 1000),
    mapName: "de_dust2",
  },
})

// Update player statistics
await db.player.update({
  where: { playerId: 123 },
  data: {
    kills: { increment: 1 },
    skill: { increment: 25 },
    lastEvent: Math.floor(Date.now() / 1000),
  },
})
```

### Advanced Queries with Transactions

```typescript
import { databaseClient } from "@repo/db/client"

// Complex operations with transaction safety
const result = await databaseClient.transaction(async (tx) => {
  // Update killer stats
  const killer = await tx.player.update({
    where: { playerId: killerId },
    data: {
      kills: { increment: 1 },
      skill: { increment: skillGain },
    },
  })

  // Update victim stats
  const victim = await tx.player.update({
    where: { playerId: victimId },
    data: {
      deaths: { increment: 1 },
      skill: { decrement: skillLoss },
    },
  })

  // Record the event
  const event = await tx.eventFrag.create({
    data: {
      /* event data */
    },
  })

  return { killer, victim, event }
})
```

## Development Commands

| Command            | Purpose                          | When to Use                    |
| ------------------ | -------------------------------- | ------------------------------ |
| `pnpm db:generate` | Generate Prisma client & types   | After schema changes           |
| `pnpm build`       | Compile TypeScript to JavaScript | After changing `src/` files    |
| `pnpm dev`         | Watch mode compilation           | During active development      |
| `pnpm db:push`     | Push schema to database          | After schema changes (dev)     |
| `pnpm db:migrate`  | Create migration files           | Before production deploy       |
| `pnpm db:studio`   | Open Prisma Studio GUI           | Database browsing/editing      |
| `pnpm db:seed`     | Seed with development data       | Initial setup or reset         |
| `pnpm db:fresh`    | Reset to clean state             | Clear player data, keep config |
| `pnpm lint`        | Run ESLint checks                | Code quality                   |
| `pnpm check-types` | TypeScript validation            | Type checking                  |

## Development Cycle & Build Process

Understanding the correct order of operations is crucial for development:

### Directory Structure

```
packages/db/
├── src/                    # Source TypeScript files
│   ├── index.ts           # Main entry point - exports `db` client
│   ├── seed.ts            # Database seeding scripts
│   └── pothos.config.cjs  # Pothos code generation config
├── generated/             # Generated by Prisma (Step 1)
│   ├── index.js           # Generated Prisma client
│   ├── index.d.ts         # Generated TypeScript types
│   └── graphql/           # Generated Pothos types & inputs
├── dist/                  # Compiled TypeScript output (Step 2)
│   ├── index.js           # Compiled src/index.ts
│   └── index.d.ts         # Compiled type definitions
└── prisma/
    └── schema.prisma      # Database schema definition
```

### **Correct Development Workflow**

#### **Step 1: Generate Prisma Client & Types**

```bash
pnpm db:generate
```

**What this does:**

- Deletes old `generated/` folder
- Generates Prisma client to `./generated/`
- Generates Pothos GraphQL types to `./generated/graphql/`
- Creates type definitions for your database schema

#### **Step 2: Build TypeScript Source**

```bash
pnpm build
```

**What this does:**

- Compiles `src/index.ts` → `dist/index.js` (ESM format)
- Compiles TypeScript type definitions → `dist/index.d.ts`
- Makes the package consumable by other apps

### **Why This Order Matters**

1. **`src/index.ts` depends on `generated/`**:

   ```typescript
   import { PrismaClient } from "../generated" // Must exist first!
   ```

2. **Other packages import from `dist/`**:
   ```typescript
   // apps/daemon/src/database/client.ts
   import { db, type PrismaClient } from "@repo/db/client"
   ```
   This resolves to `packages/db/dist/index.js` via package.json exports.

### **Common Issues**

**Import errors**: If you get `does not provide an export named 'db'`:

1. Run `pnpm db:generate` first
2. Then run `pnpm build`
3. The error usually means step 1 or 2 was skipped

**Module format errors**: With Node.js 22+, ensure:

- Package has `"type": "module"`
- Exports point to compiled `.js` files in `dist/`
- Config files use `.cjs` extension for CommonJS

### **Package.json Exports**

```json
{
  "exports": {
    "./client": {
      "types": "./dist/index.d.ts", // TypeScript types
      "import": "./dist/index.js" // ESM JavaScript
    }
  }
}
```

### **Schema Development Workflow**

1. Edit `prisma/schema.prisma`
2. `pnpm db:generate` (regenerate client)
3. `pnpm db:push` (apply to dev database)
4. `pnpm build` (compile for consumption)
5. Test in dependent apps

Remember: **Generate first, build second!**

## Schema Design Principles

- **Consistent naming**: camelCase fields, singular table names
- **Proper relationships**: Foreign keys with cascade rules
- **Performance indexes**: Strategic indexing for common queries
- **Extensible structure**: Easy to add new game types and statistics
- **Legacy compatibility**: Import-friendly structure for data migration
- **Type safety**: Full TypeScript integration with generated types
