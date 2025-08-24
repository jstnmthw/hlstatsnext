# HLStats Daemon - Migration Progress

## Overview

This document outlines the comprehensive plan to rewrite the legacy Perl-based HLStats daemon into a modern, scalable, and maintainable microservice using TypeScript and Node.js. It serves as the single source of truth for the migration project, detailing everything from high-level architecture to granular implementation steps.

---

## Project Goal

To replace the old HLstatsX Perl program with a robust, testable, and cloud-native solution for a modern real-time game analytics, seamlessly integrated into the existing monorepo.

---

## Core Technologies

- **Runtime**: Node.js 24+ with TypeScript 5.x
- **Database**: Prisma ORM with MySQL (utilizing the existing schema)
- **Message Queue**: Redis + BullMQ for robust event processing
- **Caching**: Redis for session management and frequently accessed data
- **Validation**: Zod for compile-time and runtime type safety
- **Testing**: Vitest for unit/integration tests, Supertest for API testing

### Service Architecture

The daemon is designed as a set of cohesive microservices, each with a distinct responsibility. This modular approach enhances scalability and maintainability.

- **Log Ingress Service**: Listens for UDP log streams from game servers, performs initial parsing, and enqueues events into Redis.
- **Event Processor Service**: The core of the application. Consumes events from the message queue, applies business logic, and updates the database.
- **RCON Service**: Provides an interface for remote server administration via the RCON protocol.
- **Statistics Service**: Aggregates and calculates real-time statistics, serving them via an API.

---

## **Phase 1: Foundation & Infrastructure** ✅

### Objectives

Establish core architecture, services skeleton, and development infrastructure.

### Completed Features

#### **Project Setup** ✅

- ✅ Turbo Repo monorepo structure
- ✅ TypeScript configuration with strict mode
- ✅ ESLint and Prettier setup
- ✅ Vitest testing framework
- ✅ Development scripts (dev, build, test, lint, check-types)

#### **Core Services** ✅

- ⚠️ **Gateway Service**: Removed - using `apps/api` instead
- ✅ **Ingress Service**: UDP server for game log reception
  - ✅ High-performance UDP packet handling
  - ✅ Rate limiting per IP address
  - ✅ Queue manager with Redis/BullMQ integration
  - ✅ Base parser framework
- ✅ **Event Processor Service**: Core event handling pipeline
  - ✅ Event routing system
  - ✅ Handler architecture
  - ✅ Database persistence layer
- ✅ **RCON Service**: Remote console command skeleton
- ✅ **Statistics Service**: Stats aggregation skeleton

#### **Database Integration** ✅

- ✅ DatabaseClient wrapper for Prisma
- ✅ Connection pooling and error handling
- ✅ Transaction support
- ✅ Legacy HLStatsX schema compatibility
- ✅ Type-safe database operations

#### **Event System** ✅

- ✅ Comprehensive event type definitions
- ✅ Type-safe event processing pipeline
- ✅ Event persistence to legacy tables
- ✅ Player ID resolution system

#### **Testing Infrastructure** ✅

- ✅ Unit test suite with Vitest
- ✅ Mock implementations for all services
- ✅ Test coverage for critical paths
- ✅ CI-ready test commands

### Phase 1 Metrics

- **Duration**: 6 weeks
- **Test Coverage**: 95+ tests passing
- **Code Quality**: Zero ESLint warnings, strict TypeScript

---

## **Phase 2: Player Lifecycle & Core Statistics** ✅

### Objectives

Implement complete player tracking, event processing, and ranking system.

### Completed Features

#### **Event Parsing** ✅

- ✅ CS:GO/CS2 log parser implementation
- ✅ Player connect event parsing
- ✅ Player disconnect event parsing
- ✅ Player kill event parsing
- ✅ Player suicide event parsing
- ✅ Player teamkill event parsing
- ✅ Chat message parsing
- ✅ Bot detection and metadata extraction

#### **Player Management** ✅

- ✅ Player creation and unique ID tracking
- ✅ Steam ID to Player ID resolution
- ✅ Bot player support with configurable logging
- ✅ Player name history tracking
- ✅ Connection time tracking

#### **Event Handlers** ✅

- ✅ **PlayerHandler**: Complete lifecycle management
  - ✅ Connect/disconnect processing
  - ✅ Kill/death/suicide/teamkill handling
  - ✅ Streak tracking (kill/death streaks)
  - ✅ Skill rating updates
- ✅ **WeaponHandler**: Weapon statistics tracking
- ✅ **MatchHandler**: Round and match state management
- ✅ **RankingHandler**: ELO-based skill calculations

#### **Statistics System** ✅

- ✅ Real-time player statistics updates
- ✅ Kill/Death ratio tracking
- ✅ Headshot percentage calculation
- ✅ Suicide and teamkill tracking
- ✅ ELO-based skill rating system
  - ✅ Dynamic skill delta calculation
  - ✅ Skill floor protection (minimum 100)
  - ✅ Penalties for suicides and teamkills

#### **Player Rankings** ✅

- ✅ Top 50+ player query system
- ✅ Filter by game type
- ✅ Hidden player visibility control
- ✅ Sort by skill rating
- ✅ Database query optimization

#### **Testing & Validation** ✅

- ✅ Unit tests for all new event types
- ✅ Parser validation tests
- ✅ Integration test scripts
- ✅ Player ranking verification tools

#### **Documentation** ✅

- ✅ **Player Rankings System**: Comprehensive documentation of ELO-based rating calculations
  - ✅ Mathematical foundations and formulas
  - ✅ Event-based rating adjustments (kills, suicides, teamkills)
  - ✅ Weapon skill multipliers and headshot bonuses
  - ✅ Special cases and edge conditions
  - ✅ Performance metrics and analytics guidelines
  - ✅ Implementation examples and calculations
- ✅ **Migration Progress Tracking**: Detailed phase completion documentation
- ✅ **Development Best Practices**: Coding standards and architectural guidelines
- ✅ **TypeScript Resolution**: Complete type safety without `any` usage

### Phase 2 Metrics

- **New Events**: 5 event types fully implemented
- **Test Coverage**: 97+ tests total (all passing)
- **Features**: Complete player lifecycle tracking
- **Documentation**: 4 comprehensive guides covering system architecture
- **Code Quality**: Zero TypeScript errors, strict type safety enforced
- **Architecture**: Clean discriminated unions, no `any` type usage

---

## **Phase 3: Multi-Game Support & Advanced Parsing** 🚧

### Completed Features ✅

- ✅ **WeaponService**: DB-first weapon multiplier service with in-memory cache
- ✅ Static **weapon-config** aligned with PLAYER_RANKINGS and per-game maps
- ✅ **Game alias resolver** (e.g. `cstrike` → `csgo`) for legacy log support
- ✅ Refactored **RankingHandler**, **WeaponHandler**, and Processor to use WeaponService and be game-aware
- ✅ Rating logic updated for weapon multipliers & team-kill skill compensation
- ✅ Unit-test coverage added (WeaponService tests) – total tests: **147** all passing
- ✅ Type-check & ESLint pipelines green

### Remaining Objectives

Extend parser support to all Half-Life engine games and implement advanced event tracking.

### Planned Features

---

## **Phase 4: Round & Match Events** ✅

### Objectives

Implement round and match event handling with proper event routing.

### Completed Features

#### **Event Routing Fix** ✅

- ✅ **Fixed conflicting logs**: Resolved issue where `ROUND_START` and `ROUND_END` events were both being handled by `MatchHandler` and marked as "Unhandled event type" in `EventService`
- ✅ **EventService updates**: Added explicit cases for `ROUND_START`, `ROUND_END`, `TEAM_WIN`, and `MAP_CHANGE` events to prevent false "unhandled" warnings
- ✅ **Proper event flow**: Events are now correctly routed through the processing pipeline without duplicate warnings
- ✅ **Memory-only handling**: Round events are handled in memory by `MatchHandler` and don't require database persistence
- ✅ **Test validation**: All 187 tests passing, confirming no regressions

#### **Event Processing Pipeline** ✅

- ✅ **EventProcessorService**: Routes round events to `MatchHandler` for in-memory processing
- ✅ **EventService**: Explicitly handles round events without database persistence
- ✅ **MatchHandler**: Manages round state, match statistics, and player round participation
- ✅ **Clean separation**: Database persistence vs. in-memory state management properly separated

#### **Queue-First Visibility Improvements** ✅

- ✅ Added periodic INFO-level metrics for the real RabbitMQ consumer mirroring Shadow Consumer output
  - Logs every 30 seconds by default (configurable via `metricsInterval`)
  - Includes: Events Received, Events Processed, Validation Errors, Events/sec, per-queue received/processed/errors
  - Controlled via consumer config flags: `logMetrics` (default: true), `metricsInterval` (default: 30000)

### Phase 4 Metrics

- **Bug Fixes**: 1 critical event routing issue resolved
- **Test Coverage**: 187 tests passing (no regressions)
- **Code Quality**: Zero ESLint warnings, strict TypeScript compliance
- **Event Flow**: Clean, non-conflicting event processing pipeline

#### **Queue Priority Reclassification** ✅

- ✅ Reprioritized RabbitMQ bindings to align with live ranking updates and future RCON feedback loops
  - High priority (`hlstats.events.priority`): `player.kill`, `player.suicide`, `player.teamkill`, `action.*`
  - Standard (`hlstats.events.standard`): `player.connect`, `player.disconnect`, `player.entry`, `player.change.*`, `admin.*`, `team.*`, `map.*`, `round.*`, `bomb.*`, `hostage.*`, `flag.*`, `control.*`
  - Bulk (`hlstats.events.bulk`): `weapon.*`, `stats.*`, `chat.*`
- ✅ Updated in-code topology (`queue/rabbitmq/client.ts`) and development config (`messaging/module.ts`)
- ✅ Synchronized Docker RabbitMQ `definitions.json`
- ✅ Adjusted tests to reflect new default priority mapping and bindings
- ✅ All quality gates green: lint, type-check, and tests

#### **Game-Specific Parsers**

- [ ] Team Fortress Classic parser
- [ ] Day of Defeat parser
- [ ] Half Life Server parser
- [ ] Deathmatch Server parser

#### **Advanced Event Types**

- [x] Objective-based events (DB-first, canonical ACTION\_\* flow)
  - [x] Bomb plant/defuse (CS) via ACTION_PLAYER, matched by `Actions` table
  - [x] Hostage rescue (CS) via ACTION_PLAYER
  - [ ] Flag capture (TF/TF2)
  - [ ] Control point capture
- [ ] Server-based events
  - [ ] lills
  - [ ] players
  - [ ] rounds
  - [ ] suicides
  - [ ] headshots
  - [ ] bombsPlanted
  - [ ] bombsDefused
  - [ ] ctWins
  - [ ] tsWins
  - [ ] activePlayers
  - [ ] maxPlayers
  - [ ] activeMap
  - [ ] mapRounds
  - [ ] mapCtWins
  - [ ] mapTsWins
  - [ ] mapStarted
  - [ ] mapChanges
  - [ ] ctShots
  - [ ] ctHits
  - [ ] tsShots
  - [ ] tsHits
  - [ ] mapCtShots
  - [ ] mapCtHits
  - [ ] mapTsShots
  - [ ] mapTsHits

#### **Server Management**

- [ ] Server registration system
- [ ] Server authentication tokens
- [ ] Multi-server support
- [ ] Server grouping/tagging
- [ ] Map rotation tracking

---

## **Phase 4: RCON & Live Features**

### Objectives

Implement remote console functionality and real-time features.

### Planned Features

#### **RCON Implementation**

- [ ] Source RCON protocol
- [ ] GoldSource RCON protocol
- [ ] Command queue system
- [ ] Connection pooling
- [ ] Encrypted password storage
- [ ] Command rate limiting

#### **Live Features**

- [ ] Real-time player tracking
- [ ] Live match statistics
- [ ] Server monitoring
  - [ ] Player count tracking
  - [ ] Performance metrics
  - [ ] Uptime monitoring
- [ ] Alert system
  - [ ] Server down notifications
  - [ ] Suspicious activity detection
  - [ ] Performance alerts

#### **In-Game Integration**

- [ ] Chat commands (!rank, !stats)
- [ ] In-game announcements
- [ ] Skill change notifications
- [ ] Achievement announcements

---

## **Phase 5: Performance & Production**

### Objectives

Optimize performance, implement caching, and prepare for production deployment.

### Planned Features

#### **Performance Optimization**

- [ ] Database query optimization
  - [ ] Index optimization
  - [ ] Query batching
  - [ ] Connection pooling tuning
- [ ] Caching layer
  - [ ] Redis caching strategy
  - [ ] Memory cache for hot data
  - [ ] Cache invalidation patterns
- [ ] Event processing optimization
  - [ ] Batch processing
  - [ ] Parallel processing
  - [ ] Queue optimization

#### **Production Readiness**

- [ ] Docker containerization
- [ ] Kubernetes deployment configs
- [ ] Environment configuration
- [ ] Secrets management
- [ ] Health checks and readiness probes
- [ ] Graceful shutdown handling

#### **Monitoring & Observability**

- [ ] Prometheus metrics (monorepo)
- [ ] Grafana dashboards (monorepo)
- [ ] Distributed tracing
- [ ] Structured logging
- [ ] Error tracking (Sentry - monorepo)
- [ ] Performance monitoring (monorepo)

#### **Documentation**

- [ ] Deployment guide
- [ ] Configuration reference
- [ ] Migration guide
- [ ] Troubleshooting guide

---

## **Phase 6: Testing & Release Candidate**

### Objectives

Comprehensive testing, bug fixes, and RC preparation.

### Planned Features

#### **Testing Suite**

- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Load testing
- [ ] Stress testing
- [ ] Security testing
- [ ] Backward compatibility tests

#### **Bug Fixes & Polish**

- [ ] Performance bottleneck resolution
- [ ] Edge case handling
- [ ] Error message improvements
- [ ] Logging enhancements
- [ ] Code cleanup and refactoring

#### **Release Preparation**

- [ ] Version tagging
- [ ] Changelog generation
- [ ] Release notes
- [ ] Migration scripts
- [ ] Rollback procedures

---

## Summary

### Completed ✅

- **Phase 1**: Foundation & Infrastructure (100%)
- **Phase 2**: Player Lifecycle & Core Statistics (100%)

### In Progress 🚧

- **Phase 3**: Multi-Game Support & Advanced Parsing (**~20% complete**)

### Upcoming

- **Phase 4**: RCON & Live Features
- **Phase 5**: Performance & Production
- **Phase 6**: Testing & Release Candidate

### Total Estimated Timeline

- **Completed**: ~10 weeks
- **Remaining**: ~20-25 weeks
- **Total to RC**: ~30-35 weeks

### Current Status

The daemon has a solid foundation with complete player lifecycle tracking. The next priority is expanding game support and building the API layer for integration with the web frontend.

### Roadmap and documentation updates

- Added `apps/daemon/docs/ROADMAP.md` with an up-to-date plan covering immediate next steps (history/activity, GeoIP, objective persistence, server load), short-/medium-term items (awards/ribbons, admin/bans, multi-game parsers, caching, distributed processing), and RC readiness criteria.

---

## Change Log

- 2025-01-XX - **Fixed Tailwind font-size mapping and implemented simple 2px increment scale**
  - **Problem**: `text-base` class was showing 16px instead of the custom `--font-size-base` value of 14px defined in theme files.
  - **Root Cause**: Tailwind v4's default font-size utilities were not being properly overridden by the CSS variables defined in the `@theme` directive.
  - **Solution**:
    1. Added explicit utility class overrides in `@layer utilities` to ensure Tailwind's `text-*` classes use custom CSS variables
    2. Implemented simple 2px increment font scale: xs=10px, sm=12px, base=14px, lg=16px, xl=18px, etc.
    3. Updated line heights to maintain good readability ratios (1.6x for small text, scaling down to 1.24x for largest)
  - **Font Scale**:
    - `text-xs` = 10px (line-height: 16px)
    - `text-sm` = 12px (line-height: 18px)
    - `text-base` = 14px (line-height: 21px)
    - `text-lg` = 16px (line-height: 24px)
    - `text-xl` = 18px (line-height: 26px)
    - And so on in 2px increments...
  - **Files Modified**:
    - `apps/web/src/app/globals.css` - Added font-size utility overrides and implemented simple scale
    - `packages/ui/src/components/button.tsx` - Updated button sizes to use new font scale
    - **Button Size Alignment**:
    - `xs` = text-xs (10px) with standard padding (spacing.2)
    - `sm` = text-sm (12px) with standard padding (spacing.2)
    - `default` = text-base (14px) with standard padding (spacing.3)
    - `lg` = text-lg (16px) with extra X spacing (spacing.4)
    - `xl` = text-xl (18px) with extra X spacing (spacing.5)
  - **Result**: Clean, predictable font sizing with 2px increments across all components, eliminating complex percentage calculations.

- 2025-08-11
  - players_names: Added repository upsert method and wired alias aggregation across connect, change-name, disconnect (connection_time), kill (killer/victim), damage (shots/hits/headshots), teamkill (victim death). Tests added for repository and service wiring.
  - players_history: Confirmed snapshot writes via `MatchRepository.createPlayerHistory` and `MatchService.saveMatchToDatabase`; no schema change needed.
  - Quality gates: Type-check, lint green; fixed tests remain green after updating code.

- 2025-08-12
  - GeoIP seeding: Updated `packages/database/src/scripts/seed-geoip.ts` to use MaxMind download permalinks with Basic Auth (Account ID + License Key). Switched CSV download format to `.zip` and added system `unzip`-based extraction with fallback helper. Env example updated to include `MAXMIND_ACCOUNT_ID` and `MAXMIND_LICENSE_KEY`. This resolves 404s from deprecated unauthenticated URLs and aligns with MaxMind's current documentation.

- 2025-01-XX - **UI Package JIT Restructuring: Adopted TurboRepo JIT pattern for @repo/ui**
  - **Problem**: `@repo/ui` package was using pre-compilation pattern with individual component exports, which was tedious to maintain and inconsistent with monorepo's JIT pattern
  - **Root Cause**: Original setup required manual export definitions for each component and separate build processes, contrary to TurboRepo best practices for shared packages
  - **Solution**:
    1. Simplified `package.json` exports to use source TypeScript files directly (`"." -> "./src/index.ts"`)
    2. Created barrel export in `src/index.ts` for all components and utilities
    3. Removed build scripts and build-time dependencies (`@tailwindcss/cli`, `tailwindcss`)
    4. Updated all consuming apps to import from `@repo/ui` main entry point
    5. Removed TurboRepo generators that were tied to old export pattern
  - **Files Modified**:
    - `packages/ui/package.json` - Simplified exports, removed build scripts
    - `packages/ui/src/index.ts` - New barrel export file
    - `packages/ui/turbo.json` - Removed build tasks
    - All web app import statements - Changed from `@repo/ui/button` to `@repo/ui`
  - **Validation**: TypeScript compilation and Next.js builds pass, JIT consumption working correctly
  - **Result**: Simplified maintenance, consistent with monorepo patterns, shared Tailwind v4 config processes all CSS together

- 2025-01-XX - **Dependency Cleanup: Fixed React duplication in UI package**
  - **Problem**: In `packages/ui/package.json`, React and React DOM were incorrectly listed in both `dependencies` and `peerDependencies`
  - **Root Cause**: Shared UI libraries should only have React as a `peerDependency` to avoid bundling multiple versions and potential conflicts
  - **Solution**: Removed `react` and `react-dom` from the `dependencies` section, keeping them only in `peerDependencies`
  - **Files Modified**: `packages/ui/package.json` - Cleaned up dependencies section
  - **Validation**: All monorepo packages reviewed, lint/type-check/tests pass, no other dependency misplacements found
  - **Result**: Proper dependency management across monorepo, avoiding React version conflicts in consuming applications

- 2025-01-XX - **Server Add Form Error Message UX Enhancement**
  - **Problem**: In the admin server creation form, error messages displayed at the top would persist even when the user re-submitted the form, creating poor UX
  - **Root Cause**: The `useActionState` hook maintains the previous error state until the new action completes, causing error messages to remain visible during form submission
  - **Solution**:
    1. Created `ErrorDisplay` component that uses `useFormStatus` to detect pending form submission
    2. Error messages are automatically hidden when `pending` is true or when `state.success` is true
    3. This provides immediate feedback to users that their re-submission attempt is being processed
  - **Files Modified**:
    - `apps/web/src/features/admin/components/server-create-form.tsx` - Added ErrorDisplay component with pending state handling
  - **Result**: Improved UX where error messages disappear immediately when user re-submits form, providing clear visual feedback

- 2025-08-10
  - Parser: Added support for legacy/GoldSrc-style connect lines ("entered the game") in `CsParser`.
  - Persistence: Implemented connect/disconnect logging to `events_connect` and `events_disconnect` via `PlayerRepository.createConnectEvent`/`createDisconnectEvent`; on disconnect, backfills `event_time_disconnect` on the last connect row.
  - Server Config: `ServerRepository.getServerConfig` + `ServerService.getServerConfigBoolean` added; `PlayerEventHandler` now honors per-server `IgnoreBots` to skip bot connect/disconnect lifecycle events when enabled.
  - Validation: Lint, type-check, and full test suite green.
