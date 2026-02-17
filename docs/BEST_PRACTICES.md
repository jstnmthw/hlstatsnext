# HLStats Next - Development Best Practices & Methodologies

## **Project Context & Objective**

We are rebuilding the legacy Perl-based HLstatsX daemon (located at `@/daemon`) from scratch as a modern TypeScript/Node.js microservice. The new daemon will collect, process, and aggregate statistics from Half-Life dedicated game servers (such as player stats, matches, maps, events, and more). This rewrite aims to provide a scalable, maintainable, and secure foundation for real-time game analytics, replacing the old HLstatsX Perl program with a robust, testable, and cloud-native solution.

## **Table of Contents**

1. [Architecture Principles](#architecture-principles)
2. [Development Workflow](#development-workflow)
3. [Code Standards](#code-standards)
4. [Testing Strategies](#testing-strategies)
5. [Performance Guidelines](#performance-guidelines)
6. [Security Practices](#security-practices)
7. [Monitoring & Observability](#monitoring--observability)
8. [Deployment & Operations](#deployment--operations)
9. [Team Collaboration](#team-collaboration)

---

## **1. Architecture Principles**

### **1.1 Domain-Driven Design (DDD)**

Our system is organized around business domains:

```typescript
// ✅ GOOD: Clear domain boundaries
// packages/db/src/domains/player/player.service.ts
export class PlayerService {
  async calculateSkillRating(playerId: number): Promise<SkillRating> {
    // Domain logic encapsulated
  }
}

// ❌ BAD: Mixed concerns
// src/utils/everything.ts
export function calculatePlayerStuff() {
  // Database, business logic, and API concerns mixed
}
```

### **1.2 Clean Architecture Layers**

```
┌─────────────────────────────────────────────┐
│            Presentation Layer               │
│         (GraphQL, REST, WebSocket)          │
├─────────────────────────────────────────────┤
│            Application Layer                │
│          (Use Cases, DTOs)                  │
├─────────────────────────────────────────────┤
│             Domain Layer                    │
│      (Entities, Business Rules)             │
├─────────────────────────────────────────────┤
│          Infrastructure Layer               │
│      (Database, External APIs)              │
└─────────────────────────────────────────────┘
```

### **1.3 SOLID Principles**

**Single Responsibility**:

```typescript
// Each class has one reason to change
class EventProcessor {
  process(event: GameEvent): Promise<void> {
    // Only processes events
  }
}

class EventValidator {
  validate(event: GameEvent): ValidationResult {
    // Only validates events
  }
}
```

**Open/Closed**:

```typescript
// Open for extension, closed for modification
abstract class BaseParser {
  abstract parse(logLine: string): GameEvent
}

class CS2Parser extends BaseParser {
  parse(logLine: string): GameEvent {
    // CS2-specific parsing
  }
}
```

**Dependency Inversion**:

```typescript
// Depend on abstractions, not concretions
interface IPlayerRepository {
  findById(id: number): Promise<Player>
}

class PlayerService {
  constructor(private repo: IPlayerRepository) {}
  // Service doesn't know about database implementation
}
```

---

## **2. TurboRepo Monorepo Development Workflow**

### **2.1 Package Development Strategy**

**Shared Package First Approach**:

```bash
# When adding new features, consider package placement
# 1. Is this logic used by multiple apps? → shared package
# 2. Is this app-specific? → local app directory
# 3. Is this a domain concept? → database package or dedicated domain package

# Example: Adding player statistics calculation
# ✅ GOOD: Shared logic in database package
packages/db/src/utils/player-stats.ts

# ✅ GOOD: App-specific UI logic in web app
apps/web/src/components/player-stats-chart.tsx

# ✅ GOOD: App-specific processing logic in daemon
apps/daemon/src/processors/player-stats-processor.ts
```

**TurboRepo Commands & Development**:

```bash
# Install dependencies for all packages
pnpm install

# Build all packages (respects dependency order)
pnpm build

# Run specific app
pnpm --filter @repo/daemon dev
pnpm --filter @repo/web dev

# Run command in multiple packages
pnpm --filter "@repo/daemon-*" test
pnpm --filter "@repo/*" lint

# Add dependency to specific package
pnpm --filter @repo/daemon add lodash
pnpm --filter @repo/web add @types/react

# Add shared package dependency
pnpm --filter @repo/daemon add @repo/db

# Generate types (typically in database package)
pnpm --filter @repo/db db:generate
```

**Type-Safe Package Development**:

```typescript
// Always export both types and runtime values separately
export { PlayerService } from './services/player.service';
export { GameEventProcessor } from './services/game.service';

// Validate types work across packages in CI
// .github/workflows/type-check.yml
- name: Type check all packages
  run: pnpm type-check

- name: Build all packages
  run: pnpm build

- name: Test type compatibility
  run: pnpm --filter "@repo/*" type-check
```

## **2.2 Development Workflow**

### **2.1 Git Workflow**

**Branch Naming Convention**:

```bash
feature/daemon-event-processor
fix/player-stats-calculation
chore/update-dependencies
docs/api-documentation
```

**Commit Message Format**:

```
type(scope): subject

body

footer
```

**Examples**:

```bash
feat(daemon): add UDP server implementation

- Implemented high-performance UDP listener
- Added connection pooling
- Integrated with event queue

Closes #123

fix(api): correct player stats calculation

The K/D ratio was using integer division instead of float.
This fixes the precision issue reported by users.
```

### **2.2 Code Review Checklist**

- [ ] **Functionality**: Does it work as intended?
- [ ] **Tests**: Are there adequate tests?
- [ ] **Performance**: No obvious bottlenecks?
- [ ] **Security**: Input validation present?
- [ ] **Documentation**: Code and API documented?
- [ ] **Style**: Follows project conventions?
- [ ] **Dependencies**: Necessary and up-to-date?

### **2.3 Development Environment**

**Required Tools**:

```json
{
  "node": ">=20.0.0",
  "pnpm": ">=8.0.0",
  "docker": ">=24.0.0",
  "typescript": ">=5.0.0"
}
```

**VS Code Extensions**:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "graphql.vscode-graphql",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

---

## **3. Code Standards**

### **3.1 TypeScript Guidelines**

**Strict Type Safety Configuration**:

```typescript
// tsconfig.json - Maximum strictness
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Never Use `any` - Zero Tolerance Policy**:

```typescript
// ❌ NEVER: Using any defeats TypeScript's purpose
function processData(data: any): any {
  return data.someProperty.nested.value
}

// ✅ ALWAYS: Use proper types, even for complex scenarios
interface ApiResponse<T> {
  data: T
  status: number
  message: string
}

interface NestedData {
  someProperty: {
    nested: {
      value: string
    }
  }
}

function processData(data: NestedData): string {
  return data.someProperty.nested.value
}

// ✅ For truly unknown data, use unknown and type guards
function processUnknownData(data: unknown): string {
  if (isNestedData(data)) {
    return data.someProperty.nested.value
  }
  throw new Error("Invalid data structure")
}

function isNestedData(data: unknown): data is NestedData {
  return (
    typeof data === "object" &&
    data !== null &&
    "someProperty" in data &&
    typeof (data as any).someProperty.nested.value === "string"
  )
}
```

**TurboRepo Monorepo Type Organization**:

```typescript
// Monorepo structure with shared types
hlstatsnext/
├── packages/
│   ├── database/                    # Shared database package
│   │   ├── src/
│   │   │   ├── index.ts            # Re-export Prisma client & types
│   │   │   └── types/              # Database-derived types
│   │   │       ├── generated.ts    # Auto-generated from Prisma
│   │   │       └── extensions.ts   # Custom extensions
│   │   └── prisma/
│   │       └── schema.prisma       # Source of truth for types
│   │
│   ├── ui/                         # Shared React components
│   │   └── src/
│   │       └── types/
│   │           └── component.types.ts
│   │
│   └── config/                     # Shared configurations
│       └── src/
│           └── types/
│               ├── env.types.ts
│               └── constants.types.ts
│
├── apps/
│   ├── daemon/                  # Daemon application
│   │   └── src/
│   │       ├── types/              # Daemon-specific types only
│   │       │   ├── events.types.ts
│   │       │   ├── processing.types.ts
│   │       │   └── index.ts
│   │       └── services/
│   │
│   ├── web/                        # Next.js web application
│   │   └── src/
│   │       ├── types/              # Web-specific types only
│   │       │   ├── api.types.ts
│   │       │   ├── ui.types.ts
│   │       │   └── index.ts
│   │       └── components/
│   │
│   └── api/                        # GraphQL API application
│       └── src/
│           ├── types/              # API-specific types only
│           │   ├── resolvers.types.ts
│           │   ├── context.types.ts
│           │   └── index.ts
│           └── schema/

// Import hierarchy (from most specific to most general)
// 1. Local app types
// 2. Shared package types
// 3. Database types
// 4. External library types
```

**Shared Database Types with Auto-Generation**:

```typescript
// packages/db/src/index.ts
export * from "@prisma/client"
export { prisma } from "./client"

// Re-export commonly used auto-generated types
export type {
  Player,
  PlayerStats,
  GameEvent,
  Server,
  Clan,
  // ... other Prisma-generated types
} from "@prisma/client"

// Custom type extensions based on Prisma types
export type PlayerWithStats = Player & {
  stats: PlayerStats
  rank?: number
}

export type GameEventWithRelations = GameEvent & {
  player: Player
  server: Server
}

// packages/db/src/types/extensions.ts
import type { Player, PlayerStats, Prisma } from "@prisma/client"

// Utility types for database operations
export type PlayerCreateInput = Prisma.PlayerCreateInput
export type PlayerUpdateInput = Prisma.PlayerUpdateInput
export type PlayerWhereInput = Prisma.PlayerWhereInput

// Custom computed types
export type PlayerSummary = Pick<Player, "id" | "name" | "rating"> & {
  kdRatio: number
  rank: number
}

// Aggregation result types
export type PlayerStatsAggregation = {
  totalKills: number
  totalDeaths: number
  averageRating: number
  playerCount: number
}
```

**Cross-Package Type Imports**:

```typescript
// In apps/daemon/src/services/player.service.ts
import type { Player, PlayerStats, PlayerCreateInput, PlayerWithStats } from "@repo/db"

// In apps/web/src/components/player-card.tsx
import type { Player, PlayerSummary } from "@repo/db"
import type { ComponentProps } from "@repo/ui"

// In apps/api/src/resolvers/player.resolver.ts
import type { Player, PlayerWhereInput, PlayerStatsAggregation } from "@repo/db"
```

**Interface vs Type - When to Use Each**:

```typescript
// ✅ Use INTERFACE for object shapes that might be extended
export interface BasePlayer {
  id: number
  name: string
  steamId: string
}

export interface PlayerWithStats extends BasePlayer {
  stats: PlayerStats
  ranking: PlayerRanking
}

// ✅ Use TYPE for unions, computed types, and complex operations
export type GameEventType = "player_kill" | "player_death" | "round_start" | "round_end"

export type PlayerStatus = "active" | "inactive" | "banned" | "pending"

export type PlayerSearchResult = Pick<Player, "id" | "name" | "rating"> & {
  matchedFields: Array<keyof Player>
}

// ✅ Use TYPE for conditional and mapped types
export type RequiredPlayer = Required<Player>
export type PartialPlayerUpdate = Partial<Pick<Player, "name" | "email" | "settings">>

export type PlayerEventHandlers = {
  [K in GameEventType as `handle${Capitalize<K>}`]: (event: GameEvent<K>) => Promise<void>
}
```

**Explicit Type Definitions - Always Prefer Clarity**:

```typescript
// ✅ GOOD: Explicit, reusable, well-documented types
export interface PlayerStats {
  /** Total number of kills */
  kills: number
  /** Total number of deaths */
  deaths: number
  /** Number of headshot kills */
  headshots: number
  /** Accuracy percentage (0-100) */
  accuracy: number
  /** Kill/Death ratio */
  kdRatio: number
  /** Last time stats were updated */
  lastUpdated: Date
}

export interface PlayerStatsFilters {
  /** Filter by time period */
  timeframe?: "day" | "week" | "month" | "year" | "all"
  /** Filter by specific game mode */
  gameMode?: string
  /** Filter by minimum number of matches */
  minMatches?: number
}

// ❌ BAD: Inline, repetitive, unclear types
function getStats(
  timeframe?: string,
  mode?: string,
): { k: number; d: number; hs: number; acc: number } {
  // ...
}
```

**Strict Null Handling & Optional Properties**:

```typescript
// ✅ GOOD: Explicit null/undefined handling
export interface Player {
  id: number
  name: string
  email: string | null // Explicitly nullable
  lastLoginAt?: Date // Optional property
  settings: PlayerSettings // Required, never null
}

function getPlayer(id: number): Player | null {
  const player = players.find((p) => p.id === id)
  return player ?? null // Explicit null return
}

function getPlayerEmail(player: Player): string {
  // Handle nullable email properly
  if (player.email === null) {
    throw new Error("Player email is not set")
  }
  return player.email
}

// ✅ Use optional chaining for safe access
function getLastLoginYear(player: Player): number | undefined {
  return player.lastLoginAt?.getFullYear()
}

// ❌ BAD: Implicit undefined/null handling
function getPlayer(id: number) {
  // Return type unclear
  return players.find((p) => p.id === id) // Could return undefined
}
```

**Generic Types & Constraints**:

```typescript
// ✅ GOOD: Well-constrained generics
export interface Repository<T extends { id: number }> {
  findById(id: number): Promise<T | null>
  create(data: Omit<T, "id">): Promise<T>
  update(id: number, data: Partial<T>): Promise<T>
  delete(id: number): Promise<void>
}

export interface ServiceResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

// ✅ Generic functions with proper constraints
export async function processEvents<T extends GameEvent>(
  events: T[],
  processor: (event: T) => Promise<void>,
): Promise<void> {
  await Promise.all(events.map(processor))
}

// ✅ Conditional types for advanced scenarios
export type DatabaseEntity<T> = T extends { id: infer U }
  ? T & { createdAt: Date; updatedAt: Date }
  : never
```

**Union Types & Discriminated Unions**:

```typescript
// ✅ GOOD: Discriminated unions for type safety
export type GameEvent =
  | {
      type: "player_kill"
      killerId: number
      victimId: number
      weapon: string
      headshot: boolean
    }
  | { type: "player_death"; playerId: number; cause: string }
  | { type: "round_start"; mapName: string; gameMode: string }
  | { type: "round_end"; winner: "ct" | "terrorist"; duration: number }

// Type guards for union types
export function isPlayerKillEvent(
  event: GameEvent,
): event is Extract<GameEvent, { type: "player_kill" }> {
  return event.type === "player_kill"
}

// ✅ Exhaustive type checking
export function processGameEvent(event: GameEvent): void {
  switch (event.type) {
    case "player_kill":
      handleKill(event.killerId, event.victimId, event.weapon)
      break
    case "player_death":
      handleDeath(event.playerId, event.cause)
      break
    case "round_start":
      handleRoundStart(event.mapName, event.gameMode)
      break
    case "round_end":
      handleRoundEnd(event.winner, event.duration)
      break
    default:
      // TypeScript will error if we miss a case
      const _exhaustive: never = event
      throw new Error(`Unhandled event type: ${JSON.stringify(_exhaustive)}`)
  }
}
```

**Enum Best Practices**:

```typescript
// ✅ PREFERRED: Use const assertions for simple enums
export const PlayerRole = {
  ADMIN: "admin",
  MODERATOR: "moderator",
  USER: "user",
  BANNED: "banned",
} as const

export type PlayerRole = (typeof PlayerRole)[keyof typeof PlayerRole]

// ✅ Use string enums when you need reverse lookup or complex behavior
export enum GameMode {
  CLASSIC = "classic",
  DEATHMATCH = "deathmatch",
  COMPETITIVE = "competitive",
  CASUAL = "casual",
}

// ✅ Avoid numeric enums unless specifically needed
// ❌ BAD: Numeric enum (harder to debug)
enum BadPlayerRole {
  ADMIN,
  MODERATOR,
  USER,
}
```

**Utility Types Usage**:

```typescript
// ✅ Leverage TypeScript utility types effectively
export type CreatePlayerRequest = Omit<Player, "id" | "createdAt" | "updatedAt">
export type UpdatePlayerRequest = Partial<Pick<Player, "name" | "email" | "settings">>
export type PlayerSummary = Pick<Player, "id" | "name" | "rating" | "lastLoginAt">

// ✅ Custom utility types for domain-specific needs
export type WithTimestamps<T> = T & {
  createdAt: Date
  updatedAt: Date
}

export type ApiResult<T> = {
  data: T
  pagination?: PaginationInfo
  meta?: Record<string, unknown>
}

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

// Usage examples
export type PlayerWithTimestamps = WithTimestamps<Player>
export type PlayerWithRequiredEmail = RequiredFields<Player, "email">
```

**Type Guards & Runtime Validation**:

```typescript
// ✅ Comprehensive type guards
export function isValidPlayer(obj: unknown): obj is Player {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as Player).id === "number" &&
    typeof (obj as Player).name === "string" &&
    (obj as Player).name.length > 0 &&
    typeof (obj as Player).steamId === "string" &&
    /^\d{17}$/.test((obj as Player).steamId)
  )
}

export function isGameEventArray(obj: unknown): obj is GameEvent[] {
  return Array.isArray(obj) && obj.every(isGameEvent)
}

// ✅ Combine with Zod for runtime validation
import { z } from "zod"

export const PlayerSchema = z.object({
  id: z.number().positive(),
  name: z.string().min(1).max(32),
  email: z.string().email().nullable(),
  steamId: z.string().regex(/^\d{17}$/),
  rating: z.number().min(0).max(5000),
  settings: z.object({
    notifications: z.boolean(),
    privacy: z.enum(["public", "friends", "private"]),
  }),
})

export type Player = z.infer<typeof PlayerSchema>
```

**TurboRepo Package Exports & Imports**:

```typescript
// ✅ GOOD: Shared package exports
// packages/db/src/index.ts
export { prisma } from "./client"
export * from "@prisma/client"

// Custom type extensions
export type * from "./types/extensions"
export type * from "./types/computed"

// Utility functions that work with types
export { createPlayer, updatePlayerStats } from "./utils/player"
export { validateGameEvent } from "./utils/validation"

// packages/ui/src/index.ts
export * from "./components"
export type * from "./types"

// packages/config/src/index.ts
export * from "./constants"
export * from "./env"
export type * from "./types"

// ✅ App-level import organization with monorepo packages
// apps/daemon/src/services/player.service.ts
import type { Player, PlayerCreateInput, PlayerWhereInput } from "@repo/db"
import { prisma, createPlayer } from "@repo/db"
import { GAME_CONSTANTS } from "@repo/config"

// Local app types
import type { ProcessingResult, EventContext } from "@/types"
import { EventProcessor } from "@/services/event-processor"

// ✅ Web app imports
// apps/web/src/components/player-leaderboard.tsx
import type { Player, PlayerSummary } from "@repo/db"
import { Button, Card } from "@repo/ui"
import { API_ENDPOINTS } from "@repo/config"

// Local web types
import type { LeaderboardProps } from "@/types/ui"

// ❌ BAD: Mixing package boundaries
import { prisma } from "@repo/db"
import { PlayerService } from "@/services/player" // Should be in shared package if used by multiple apps
```

**Monorepo TypeScript Configuration**:

```typescript
// Root tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@repo/*": ["packages/*/src"]
    }
  },
  "references": [
    { "path": "./packages/db" },
    { "path": "./packages/ui" },
    { "path": "./packages/config" },
    { "path": "./apps/daemon" },
    { "path": "./apps/web" },
    { "path": "./apps/api" }
  ]
}

// packages/db/tsconfig.json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}

// apps/daemon/tsconfig.json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "baseUrl": "src",
    "paths": {
      "@/*": ["*"],
      "@repo/*": ["../../packages/*/src"]
    }
  },
  "references": [
    { "path": "../../packages/db" },
    { "path": "../../packages/config" }
  ],
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

**Package Dependency Management**:

```json
// packages/db/package.json
{
  "name": "@repo/db",
  "dependencies": {
    "@prisma/client": "^6.16.2",
    "prisma": "^6.16.2"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*"
  }
}

// apps/daemon/package.json
{
  "name": "@repo/daemon",
  "dependencies": {
    "@repo/db": "workspace:*",
    "@repo/config": "workspace:*"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/eslint-config": "workspace:*"
  }
}

// apps/web/package.json
{
  "name": "@repo/web",
  "dependencies": {
    "@repo/db": "workspace:*",
    "@repo/ui": "workspace:*",
    "@repo/config": "workspace:*",
    "next": "latest"
  }
}
```

**Prisma Auto-Generated Types Integration**:

```typescript
// packages/db/src/client.ts
import { PrismaClient } from "@prisma/client"

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
})

// packages/db/src/types/computed.ts
import type { Player, PlayerStats, Prisma } from "@prisma/client"

// Leverage Prisma's auto-generated validator types
export const PlayerSelectSchema = Prisma.validator<Prisma.PlayerSelect>()({
  id: true,
  name: true,
  steamId: true,
  rating: true,
  stats: {
    select: {
      kills: true,
      deaths: true,
      headshots: true,
    },
  },
})

export type PlayerWithCalculatedStats = Prisma.PlayerGetPayload<{
  select: typeof PlayerSelectSchema
}> & {
  kdRatio: number
  headshotPercentage: number
}

// Utility function that maintains type safety
export function calculatePlayerStats(
  player: Prisma.PlayerGetPayload<{ include: { stats: true } }>,
): PlayerWithCalculatedStats {
  const kdRatio =
    player.stats.deaths > 0 ? player.stats.kills / player.stats.deaths : player.stats.kills

  const headshotPercentage =
    player.stats.kills > 0 ? (player.stats.headshots / player.stats.kills) * 100 : 0

  return {
    ...player,
    kdRatio: Math.round(kdRatio * 100) / 100,
    headshotPercentage: Math.round(headshotPercentage * 100) / 100,
  }
}
```

**TurboRepo Build Integration**:

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**Function Signature Best Practices**:

```typescript
// ✅ GOOD: Explicit, strict function signatures
export async function updatePlayerStats(
  playerId: number,
  updates: Partial<PlayerStats>,
  options?: {
    validateInput?: boolean
    notifyChanges?: boolean
    userId?: number
  },
): Promise<ServiceResponse<PlayerStats>> {
  // Implementation
}

// ✅ Use overloads for complex scenarios
export function formatPlayerName(player: Player): string
export function formatPlayerName(name: string, showId: boolean): string
export function formatPlayerName(playerOrName: Player | string, showId?: boolean): string {
  if (typeof playerOrName === "string") {
    return showId ? `${playerOrName} (ID: unknown)` : playerOrName
  }
  return showId ? `${playerOrName.name} (ID: ${playerOrName.id})` : playerOrName.name
}

// ❌ BAD: Loose, unclear signatures
function updatePlayer(id: any, data?: any, options?: any): Promise<any> {
  // ...
}
```

### **3.2 Advanced TypeScript Patterns**

**Template Literal Types**:

```typescript
// ✅ Advanced string manipulation with types
export type EventHandlerName<T extends string> = `handle${Capitalize<T>}`
export type EventListenerName<T extends string> = `on${Capitalize<T>}`

// Generate method names dynamically
export type PlayerEventHandlers = {
  [K in GameEventType as EventHandlerName<K>]: (event: GameEvent & { type: K }) => Promise<void>
}

// Usage
export class EventProcessor implements PlayerEventHandlers {
  async handlePlayerKill(event: GameEvent & { type: "player_kill" }): Promise<void> {
    // Type-safe event handling
  }

  async handlePlayerDeath(event: GameEvent & { type: "player_death" }): Promise<void> {
    // Type-safe event handling
  }
}
```

**Branded Types for Domain Safety**:

```typescript
// ✅ Prevent mixing different ID types
export type PlayerId = number & { readonly __brand: "PlayerId" }
export type ServerId = number & { readonly __brand: "ServerId" }
export type SteamId = string & { readonly __brand: "SteamId" }

// Constructor functions
export function createPlayerId(id: number): PlayerId {
  if (id <= 0) throw new Error("Invalid player ID")
  return id as PlayerId
}

export function createSteamId(steamId: string): SteamId {
  if (!/^\d{17}$/.test(steamId)) throw new Error("Invalid Steam ID format")
  return steamId as SteamId
}

// Prevents accidental mixing
function getPlayerStats(playerId: PlayerId): PlayerStats {
  // Type-safe - only accepts PlayerId
}

// ❌ This would cause a compile error
const serverId: ServerId = 123 as ServerId
getPlayerStats(serverId) // Error: Argument of type 'ServerId' is not assignable to parameter of type 'PlayerId'
```

**Recursive Types & Deep Mutations**:

```typescript
// ✅ Deep readonly types
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

// ✅ Deep partial types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// ✅ Nested path types for safe object access
export type Path<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, any>
    ? K | `${K}.${Path<T[K]>}`
    : K
  : never

export type PathValue<T, P extends Path<T>> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends Path<T[K]>
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
    ? T[P]
    : never

// Usage
export function getNestedValue<T, P extends Path<T>>(obj: T, path: P): PathValue<T, P> {
  // Type-safe nested object access
  return path.split(".").reduce((current: any, key) => current?.[key], obj)
}

// Example usage
const config = {
  server: {
    database: {
      host: "localhost",
      port: 3306,
    },
  },
}

const host = getNestedValue(config, "server.database.host") // Type: string
```

**Phantom Types for State Management**:

```typescript
// ✅ State machine types
export type ConnectionState = "disconnected" | "connecting" | "connected" | "error"

export interface Connection<State extends ConnectionState = ConnectionState> {
  readonly state: State
  readonly id: string
}

export type DisconnectedConnection = Connection<"disconnected">
export type ConnectedConnection = Connection<"connected">

// State transition functions
export function connect(conn: DisconnectedConnection): Promise<ConnectedConnection> {
  // Implementation
}

export function disconnect(conn: ConnectedConnection): DisconnectedConnection {
  // Implementation
}

// ❌ This would cause compile errors
// connect(connectedConnection); // Error: connected connection can't be connected again
```

**Conditional Type Helpers**:

```typescript
// ✅ Advanced conditional type utilities
export type NonNullable<T> = T extends null | undefined ? never : T

export type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? K : never
}[keyof T]

export type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? never : K
}[keyof T]

export type FunctionProperties<T> = Pick<T, FunctionKeys<T>>
export type NonFunctionProperties<T> = Pick<T, NonFunctionKeys<T>>

// Extract method signatures
export type MethodSignatures<T> = {
  [K in FunctionKeys<T>]: T[K] extends (...args: infer Args) => infer Return
    ? (...args: Args) => Return
    : never
}

// Usage example
export interface PlayerService {
  getPlayer(id: number): Promise<Player>
  updatePlayer(id: number, data: Partial<Player>): Promise<Player>
  playerName: string
  playerCount: number
}

type ServiceMethods = FunctionProperties<PlayerService>
// Result: { getPlayer: ..., updatePlayer: ... }

type ServiceData = NonFunctionProperties<PlayerService>
// Result: { playerName: string, playerCount: number }
```

### **3.3 TypeScript Tooling & Development**

**ESLint TypeScript Rules**:

```javascript
// eslint.config.js
module.exports = {
  extends: [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking",
  ],
  rules: {
    // Enforce strict typing
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",

    // Prefer type imports
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports", disallowTypeAnnotations: false },
    ],

    // Naming conventions
    "@typescript-eslint/naming-convention": [
      "error",
      {
        selector: "interface",
        format: ["PascalCase"],
        custom: {
          regex: "^I[A-Z]",
          match: false,
        },
      },
      {
        selector: "typeAlias",
        format: ["PascalCase"],
      },
      {
        selector: "enum",
        format: ["PascalCase"],
      },
      {
        selector: "variable",
        modifiers: ["const"],
        format: ["camelCase", "UPPER_CASE", "PascalCase"],
      },
    ],

    // Function rules
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/explicit-module-boundary-types": "error",
    "@typescript-eslint/prefer-readonly": "error",
    "@typescript-eslint/prefer-readonly-parameter-types": "warn",

    // Array and object rules
    "@typescript-eslint/prefer-for-of": "error",
    "@typescript-eslint/prefer-includes": "error",
    "@typescript-eslint/prefer-string-starts-ends-with": "error",

    // Promise rules
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/require-await": "error",
    "@typescript-eslint/no-misused-promises": "error",
  },
}
```

**Type-Only Imports/Exports**:

```typescript
// ✅ ALWAYS use type-only imports for types
import type { Player, PlayerStats } from "@/types/player.types"
import type { GameEvent } from "@/types/game.types"
import type { Request, Response } from "express"

// ✅ Regular imports for runtime values
import { PlayerService } from "@/services/player.service"
import { validatePlayerData } from "@/utils/validation"

// ✅ Type-only exports
export type { Player, PlayerStats, PlayerFilters } from "./player.types"
export type { GameEvent, GameEventType } from "./game.types"

// ✅ Regular exports for runtime values
export { PlayerService } from "./player.service"
export { validatePlayer } from "./player.validation"

// ❌ BAD: Mixed imports (can cause circular dependencies)
import { Player, PlayerService, GameEvent } from "@/types"
```

**Advanced Type Testing**:

```typescript
// tests/types/type-tests.ts
import type { Equal, Expect } from "@type-challenges/utils"

// ✅ Test complex type relationships
type TestCases = [
  // Test utility types work correctly
  Expect<Equal<RequiredPlayer, Required<Player>>>,

  // Test discriminated unions
  Expect<Equal<Extract<GameEvent, { type: "player_kill" }>["killerId"], number>>,

  // Test conditional types
  Expect<
    Equal<
      DatabaseEntity<{ id: number; name: string }>,
      { id: number; name: string; createdAt: Date; updatedAt: Date }
    >
  >,

  // Test template literal types
  Expect<Equal<EventHandlerName<"player_kill">, "handlePlayerKill">>,
]

// ✅ Runtime type validation tests
describe("Type Guards", () => {
  it("should correctly identify valid player objects", () => {
    const validPlayer = {
      id: 1,
      name: "TestPlayer",
      steamId: "12345678901234567",
      email: "test@example.com",
      rating: 1500,
    }

    expect(isValidPlayer(validPlayer)).toBe(true)

    const invalidPlayer = {
      id: "not-a-number",
      name: "",
      steamId: "123", // Invalid format
    }

    expect(isValidPlayer(invalidPlayer)).toBe(false)
  })
})
```

**TypeScript Performance & Production Considerations**:

```typescript
// ✅ Optimize compilation performance
// tsconfig.json
{
  "compilerOptions": {
    // Use project references for large codebases
    "composite": true,
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",

    // Skip type checking of declaration files
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,

    // Faster but less accurate checking
    "isolatedModules": true,

    // Module resolution optimization
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}

// ✅ Use const assertions for performance
export const GAME_EVENTS = [
  'player_kill',
  'player_death',
  'round_start',
  'round_end'
] as const;

// Instead of enum which creates runtime overhead
enum GameEventEnum {
  PLAYER_KILL = 'player_kill',
  PLAYER_DEATH = 'player_death',
  ROUND_START = 'round_start',
  ROUND_END = 'round_end'
}
```

**Migration Strategies from Existing Code**:

```typescript
// ✅ Gradual migration approach

// Step 1: Add basic types to existing JavaScript
// before.js -> after.ts
function processPlayer(player) {
  return player.name.toUpperCase()
}

// After
function processPlayer(player: { name: string }): string {
  return player.name.toUpperCase()
}

// Step 2: Extract and improve types
interface Player {
  name: string
  id: number
  rating: number
}

function processPlayer(player: Player): string {
  return player.name.toUpperCase()
}

// Step 3: Add comprehensive validation
export const PlayerSchema = z.object({
  name: z.string().min(1).max(32),
  id: z.number().positive(),
  rating: z.number().min(0).max(5000),
})

export type Player = z.infer<typeof PlayerSchema>

export function processPlayer(player: Player): string {
  const validated = PlayerSchema.parse(player)
  return validated.name.toUpperCase()
}
```

**Documentation Standards for Types**:

````typescript
/**
 * Represents a game player with statistics and metadata.
 *
 * @example
 * ```typescript
 * const player: Player = {
 *   id: 1,
 *   name: "ProGamer",
 *   steamId: "12345678901234567",
 *   email: "progamer@example.com",
 *   rating: 1500,
 *   stats: {
 *     kills: 100,
 *     deaths: 50,
 *     headshots: 25,
 *     accuracy: 75.5
 *   }
 * };
 * ```
 */
export interface Player {
  /** Unique player identifier */
  readonly id: PlayerId

  /** Display name (3-32 characters, alphanumeric + underscore/dash) */
  name: string

  /** Steam ID (17 digits) */
  readonly steamId: SteamId

  /** Email address for notifications (nullable) */
  email: string | null

  /** Skill rating (0-5000 range) */
  rating: number

  /** Player statistics */
  stats: PlayerStats

  /** Account settings */
  settings: PlayerSettings

  /** When the player was first seen */
  readonly firstSeenAt: Date

  /** When the player was last active */
  lastSeenAt: Date
}

/**
 * Configuration options for player statistics calculation.
 *
 * @public
 */
export interface PlayerStatsOptions {
  /**
   * Time period for statistics calculation
   * @defaultValue 'all'
   */
  timeframe?: "day" | "week" | "month" | "year" | "all"

  /**
   * Include only specific game modes
   * @defaultValue undefined (all modes)
   */
  gameModes?: string[]

  /**
   * Minimum number of matches required
   * @defaultValue 1
   */
  minMatches?: number

  /**
   * Whether to include detailed weapon statistics
   * @defaultValue false
   */
  includeWeaponStats?: boolean
}
````

### **3.4 Error Handling**

**Custom Error Classes**:

```typescript
export class DomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class PlayerNotFoundError extends DomainError {
  constructor(playerId: number) {
    super(`Player with ID ${playerId} not found`, "PLAYER_NOT_FOUND", 404)
  }
}
```

**Result Pattern**:

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function updatePlayerStats(
  playerId: number,
  stats: Partial<PlayerStats>
): Promise<Result<Player, DomainError>> {
  try {
    const player = await playerRepo.update(playerId, stats);
    return { success: true, data: player };
  } catch (error) {
    return { success: false, error: new DomainError(...) };
  }
}
```

### **3.3 Async/Await Best Practices**

```typescript
// ✅ GOOD: Proper error handling
async function processEvents(events: GameEvent[]): Promise<void> {
  const results = await Promise.allSettled(events.map((event) => processEvent(event)))

  const failures = results.filter((r) => r.status === "rejected")
  if (failures.length > 0) {
    logger.error("Failed to process events", { failures })
  }
}

// ❌ BAD: Swallowing errors
async function processEvents(events: GameEvent[]): Promise<void> {
  await Promise.all(events.map((event) => processEvent(event).catch(() => {})))
}
```

---

## **4. Testing Strategies**

### **4.1 Test Pyramid**

```
         /\
        /  \  E2E Tests (10%)
       /    \  - Critical user paths
      /──────\  - Production-like environment
     /        \
    /          \  Integration Tests (30%)
   /            \  - API endpoints
  /──────────────\  - Database operations
 /                \  - Service interactions
/                  \
──────────────────── Unit Tests (60%)
                     - Business logic
                     - Utilities
                     - Validators
```

### **4.2 Unit Testing**

**Test Structure (AAA Pattern)**:

```typescript
describe("PlayerService", () => {
  describe("calculateSkillRating", () => {
    it("should increase rating for wins", async () => {
      // Arrange
      const player = createMockPlayer({ rating: 1000 })
      const match = createMockMatch({ winner: player.id })

      // Act
      const newRating = await service.calculateSkillRating(player, match)

      // Assert
      expect(newRating).toBeGreaterThan(player.rating)
      expect(newRating).toBeLessThan(player.rating + 50)
    })
  })
})
```

**Mock Strategies**:

```typescript
// Database mocks
const mockPrisma = {
  player: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

// External service mocks
vi.mock("@/services/steam-api", () => ({
  fetchPlayerInfo: vi.fn().mockResolvedValue({
    steamId: "123",
    avatar: "url",
  }),
}))
```

### **4.3 Integration Testing**

**API Testing**:

```typescript
describe("POST /api/events", () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it("should process valid game event", async () => {
    const event = {
      type: "player_kill",
      timestamp: new Date().toISOString(),
      data: {
        killerId: 1,
        victimId: 2,
        weapon: "ak47",
      },
    }

    const response = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: {
        Authorization: "Bearer valid-token",
      },
      payload: event,
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      id: expect.any(String),
      processed: true,
    })
  })
})
```

### **4.4 E2E Testing**

```typescript
// e2e/player-statistics.spec.ts
import { test, expect } from "@playwright/test"

test.describe("Player Statistics", () => {
  test("should display real-time stats updates", async ({ page }) => {
    // Navigate to player profile
    await page.goto("/players/123")

    // Check initial stats
    const killCount = await page.locator('[data-testid="kill-count"]')
    await expect(killCount).toHaveText("50")

    // Simulate game event via WebSocket
    await page.evaluate(() => {
      window.ws.send(
        JSON.stringify({
          type: "player_kill",
          playerId: 123,
        }),
      )
    })

    // Verify real-time update
    await expect(killCount).toHaveText("51")
  })
})
```

### **4.5 Test Data Management**

**Factories**:

```typescript
// tests/factories/player.factory.ts
export const playerFactory = Factory.define<Player>(() => ({
  id: faker.number.int(),
  name: faker.internet.userName(),
  steamId: faker.string.numeric(17),
  rating: faker.number.int({ min: 0, max: 3000 }),
  createdAt: faker.date.past(),
}))

// Usage
const player = playerFactory.build({ rating: 1500 })
const players = playerFactory.buildList(10)
```

**Fixtures**:

```typescript
// tests/fixtures/database.ts

export async function seedTestDatabase() {
  await prisma.$transaction([
    prisma.player.createMany({ data: testPlayers }),

    prisma.server.createMany({ data: testServers }),

    prisma.gameEvent.createMany({ data: testEvents }),
  ])
}

export async function cleanupDatabase() {
  await prisma.$transaction([
    prisma.gameEvent.deleteMany(),

    prisma.player.deleteMany(),

    prisma.server.deleteMany(),
  ])
}
```

---

## **5. Performance Guidelines**

### **5.1 Database Optimization**

**Query Performance & Avoiding N+1 Problems**:

A common performance pitfall is the "N+1 query problem," where an initial query retrieves a list of items (1 query), and then subsequent queries are made for each item in the list to fetch related data (N queries). This leads to a large number of database round-trips, significantly slowing down your application.

**The Problem (N+1)**:

```typescript
// ❌ BAD: N+1 query problem
// 1. First query to get all players
const players = await prisma.player.findMany()

// 2. N subsequent queries to get stats for each player
for (const player of players) {
  const stats = await prisma.playerStats.findUnique({
    // This runs for every player
    where: { playerId: player.id },
  })
  // ... do something with player and stats
}
```

If you have 100 players, this code executes 101 database queries.

**The Solution (Eager Loading)**:

Prisma provides `include` and `select` to eagerly load related data in a single query.

```typescript
// ✅ GOOD: Efficient query using `include`
// Fetches all players and their related stats in one go.
const playersWithStats = await prisma.player.findMany({
  include: {
    stats: true, // Include the full PlayerStats object
  },
})

// ✅ GOOD: Efficient query using `select` for specific fields
// Fetches all players and only specific fields from their stats.
const topPlayers = await prisma.player.findMany({
  where: {
    lastSeenAt: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  },
  orderBy: { rating: "desc" },
  take: 100,
  select: {
    id: true,
    name: true,
    rating: true,
    stats: {
      select: {
        kills: true,
        deaths: true,
      },
    },
  },
})
```

**Connection Pooling**:

```typescript
// prisma/client.ts
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ["error", "warn"],
  // Connection pool configuration
  // These are managed by the underlying engine
})

// Ensure proper cleanup
process.on("beforeExit", async () => {
  await prisma.$disconnect()
})
```

### **5.2 Caching Strategies**

**Multi-Level Caching**:

```typescript
class CacheManager {
  private memoryCache = new LRUCache<string, any>({
    max: 1000,
    ttl: 1000 * 60 * 5, // 5 minutes
  })

  async get<T>(key: string): Promise<T | null> {
    // L1: Memory cache
    const memoryHit = this.memoryCache.get(key)
    if (memoryHit) return memoryHit

    // L2: Redis cache
    const redisHit = await this.redis.get(key)
    if (redisHit) {
      const data = JSON.parse(redisHit)
      this.memoryCache.set(key, data)
      return data
    }

    return null
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const ttlSeconds = ttl || 3600 // 1 hour default

    // Set in both caches
    this.memoryCache.set(key, value)
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value))
  }
}
```

**Cache Invalidation**:

```typescript
class PlayerCacheService {
  async invalidatePlayer(playerId: number): Promise<void> {
    const patterns = [`player:${playerId}:*`, `leaderboard:*`, `stats:global:*`]

    // Clear from all cache levels
    await Promise.all([this.clearMemoryCache(patterns), this.clearRedisCache(patterns)])

    // Publish invalidation event
    await this.pubsub.publish("cache.invalidate", {
      type: "player",
      id: playerId,
      patterns,
    })
  }
}
```

### **5.3 Async Processing**

**Event Queue Management**:

```typescript
// Queue configuration with backpressure
const eventQueue = new Queue("game-events", {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
})

// Worker with concurrency control
const worker = new Worker(
  "game-events",
  async (job) => {
    await processGameEvent(job.data)
  },
  {
    connection: redis,
    concurrency: 50,
    limiter: {
      max: 100,
      duration: 1000, // 100 jobs per second
    },
  },
)
```

---

## **6. Security Practices**

### **6.1 Input Validation**

**Zod Schemas**:

```typescript
// Comprehensive validation schemas
export const PlayerUpdateSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid characters in name"),
  email: z.string().email().optional(),
  settings: z
    .object({
      notifications: z.boolean(),
      privacy: z.enum(["public", "friends", "private"]),
    })
    .optional(),
})

// API endpoint validation
app.post("/api/players/:id", async (req, res) => {
  const validation = PlayerUpdateSchema.safeParse(req.body)

  if (!validation.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.error.flatten(),
    })
  }

  // Process validated data
  await updatePlayer(req.params.id, validation.data)
})
```

### **6.2 Authentication & Authorization**

**JWT Implementation**:

```typescript
// Token generation with proper claims
export function generateAccessToken(user: User): string {
  return jwt.sign(
    {
      sub: user.id.toString(),
      email: user.email,
      roles: user.roles,
      iat: Math.floor(Date.now() / 1000),
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: "1h",
      issuer: "hlstats-api",
      audience: "hlstats-client",
    },
  )
}

// Middleware with role-based access
export function requireRole(role: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user

    if (!user || !user.roles.includes(role)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        required: role,
      })
    }

    next()
  }
}
```

### **6.3 SQL Injection Prevention**

```typescript
// ✅ GOOD: Parameterized queries
const players = await prisma.$queryRaw`
  SELECT * FROM players 
  WHERE server_id = ${serverId} 
  AND last_seen > ${minDate}
`

// ❌ BAD: String concatenation
const players = await prisma.$queryRawUnsafe(`SELECT * FROM players WHERE name = '${userName}'`)
```

### **6.4 Rate Limiting**

```typescript
// IP-based rate limiting
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl",
  points: 100, // requests
  duration: 60, // per minute
  blockDuration: 60 * 5, // block for 5 minutes
})

app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip)
    next()
  } catch (rejRes) {
    res.status(429).json({
      error: "Too many requests",
      retryAfter: Math.round(rejRes.msBeforeNext / 1000) || 60,
    })
  }
})
```

---

## **7. Monitoring & Observability**

### **7.1 Structured Logging**

**Log Levels & Context**:

```typescript
// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    service: "hlstats-daemon",
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
})

// Contextual logging
logger.info("Player action processed", {
  playerId: player.id,
  action: "kill",
  weapon: event.weapon,
  serverId: server.id,
  processingTime: Date.now() - startTime,
})
```

### **7.2 Metrics Collection**

**Prometheus Metrics**:

```typescript
// Define metrics
const metrics = {
  httpRequestDuration: new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status"],
    buckets: [0.1, 0.5, 1, 2, 5],
  }),

  activeConnections: new Gauge({
    name: "websocket_active_connections",
    help: "Number of active WebSocket connections",
  }),

  eventsProcessed: new Counter({
    name: "game_events_processed_total",
    help: "Total number of game events processed",
    labelNames: ["event_type", "game", "status"],
  }),
}

// Middleware to track metrics
app.use((req, res, next) => {
  const start = Date.now()

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000

    metrics.httpRequestDuration
      .labels(req.method, req.route?.path || "unknown", res.statusCode)
      .observe(duration)
  })

  next()
})
```

### **7.3 Distributed Tracing**

```typescript
// OpenTelemetry setup
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node"
import { Resource } from "@opentelemetry/resources"
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions"

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "hlstats-daemon",
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION,
  }),
})

// Instrument operations
export async function processEvent(event: GameEvent): Promise<void> {
  const span = tracer.startSpan("processEvent", {
    attributes: {
      "event.type": event.type,
      "event.server_id": event.serverId,
    },
  })

  try {
    await validateEvent(event)
    await storeEvent(event)
    await updateStatistics(event)

    span.setStatus({ code: SpanStatusCode.OK })
  } catch (error) {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR })
    throw error
  } finally {
    span.end()
  }
}
```

---

## **8. Deployment & Operations**

### **8.1 CI/CD Pipeline**

**GitHub Actions Workflow**:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x, 21.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run security audit
        run: pnpm audit --audit-level=high

      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  deploy:
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to production
        uses: ./.github/actions/deploy
        with:
          environment: production
          version: ${{ github.sha }}
```

### **8.2 Container Best Practices**

**Multi-Stage Dockerfile**:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy package files
COPY apps/daemon/package.json ./apps/daemon/
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm --filter @hlstatsnext/daemon build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/apps/daemon/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### **8.3 Health Checks**

```typescript
// healthcheck.ts
export async function healthCheck(): Promise<HealthStatus> {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    memory: checkMemoryUsage(),
    disk: await checkDiskSpace(),
  }

  const allHealthy = Object.values(checks).every((check) => check.healthy)

  return {
    status: allHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    uptime: process.uptime(),
    checks,
  }
}

// Health check endpoint
app.get("/health", async (req, res) => {
  const health = await healthCheck()
  const statusCode = health.status === "healthy" ? 200 : 503

  res.status(statusCode).json(health)
})

// Readiness check
app.get("/ready", async (req, res) => {
  const ready = await isServiceReady()

  if (ready) {
    res.status(200).json({ ready: true })
  } else {
    res.status(503).json({ ready: false })
  }
})
```

---

## **9. Team Collaboration**

### **9.1 Documentation Standards**

**Code Documentation**:

```typescript
/**
 * Calculates the skill rating adjustment based on match outcome.
 * Uses a modified Elo rating system with K-factor adjustments.
 *
 * @param winner - The winning player
 * @param loser - The losing player
 * @param matchDetails - Additional match context (map, weapon, etc.)
 * @returns Rating adjustments for both players
 *
 * @example
 * const adjustments = calculateRatingChange(
 *   { rating: 1500, matches: 100 },
 *   { rating: 1400, matches: 50 },
 *   { headshot: true }
 * );
 * // Returns: { winner: +25, loser: -20 }
 */
export function calculateRatingChange(
  winner: Player,
  loser: Player,
  matchDetails?: MatchContext,
): RatingAdjustment {
  // Implementation
}
```

**API Documentation**:

```typescript
/**
 * @route GET /api/players/:id/stats
 * @summary Get player statistics
 * @param {string} id.path.required - Player ID
 * @param {string} timeframe.query - Time period (day|week|month|all)
 * @param {string} gameMode.query - Game mode filter
 * @returns {PlayerStats} 200 - Player statistics
 * @returns {Error} 404 - Player not found
 * @security JWT
 */
```

### **9.2 Code Review Guidelines**

**Review Checklist**:

```markdown
## Code Review Checklist

### Functionality

- [ ] Code accomplishes the intended goal
- [ ] Edge cases are handled
- [ ] Error scenarios are covered

### Code Quality

- [ ] Follows project coding standards
- [ ] No code duplication
- [ ] Clear variable/function names
- [ ] Appropriate abstractions

### Testing

- [ ] Unit tests for new functionality
- [ ] Integration tests for API changes
- [ ] Test coverage maintained or improved

### Performance

- [ ] No obvious performance issues
- [ ] Database queries are optimized
- [ ] Caching used appropriately

### Security

- [ ] Input validation present
- [ ] No sensitive data exposed
- [ ] Authentication/authorization correct

### Documentation

- [ ] Code comments where needed
- [ ] API documentation updated
- [ ] README updated if needed
```

### **9.3 Knowledge Sharing**

**ADR (Architecture Decision Records)**:

```markdown
# ADR-001: Use Redis for Event Queue

## Status

Accepted

## Context

We need a reliable message queue for processing game events with high throughput.

## Decision

We will use Redis with Bull MQ for the event processing queue.

## Consequences

### Positive

- High performance and low latency
- Built-in retry mechanisms
- Good TypeScript support

### Negative

- Additional infrastructure dependency
- Need to manage Redis persistence

## Alternatives Considered

- RabbitMQ: More complex, overkill for our needs
- AWS SQS: Vendor lock-in, higher latency
- In-memory queue: No persistence, a single point of failure
```

---

## **Appendix: Quick Reference**

### **Common Commands**

```bash
# Development
pnpm dev                    # Start all services in dev mode
pnpm test                   # Run tests
pnpm build                  # Build all packages
pnpm lint                   # Run linting
pnpm typecheck             # Run TypeScript checks

# Database
pnpm db:migrate            # Run migrations
pnpm db:seed               # Seed database
pnpm db:studio             # Open Prisma Studio

# Docker
docker-compose up -d       # Start services
docker-compose logs -f     # View logs
docker-compose down        # Stop services

# Production
pnpm start                 # Start production server
pnpm pm2:start            # Start with PM2
pnpm pm2:logs             # View PM2 logs
```

### **Environment Variables**

```bash
# Required
NODE_ENV=production
DATABASE_URL=mysql://user:pass@host:3306/hlstats
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key

# Optional
LOG_LEVEL=info
SENTRY_DSN=https://...
PROMETHEUS_PORT=9090
ENABLE_TRACING=true
```

### **Troubleshooting**

```bash
# Clear all caches
pnpm clean

# Rebuild dependencies
pnpm install --force

# Reset database
pnpm db:reset

# Check service health
curl http://localhost:3000/health

```

---

This guide is a living document. Please contribute improvements and lessons learned!
