# HLStatsNext Daemon

The **HLStatsNext Daemon** is a high-performance, real-time game statistics engine for Half-Life engine games. This modern TypeScript implementation replaces the legacy Perl daemon with a scalable, maintainable, and production-ready microservice architecture.

## Table of Contents

- [Key Features](#key-features)
- [Architecture Overview](#architecture-overview)
  - [Event-Driven Processing Pipeline](#event-driven-processing-pipeline)
  - [Core Components](#core-components)
  - [Architectural Patterns](#architectural-patterns)
- [Server Authentication](#server-authentication)
  - [Docker Server Support](#docker-server-support)
  - [External Server Authentication](#external-server-authentication)
  - [Development Mode](#development-mode)
- [Development](#development)
  - [Quick Start](#quick-start)
  - [Project Structure](#project-structure)
- [Event Processing](#event-processing)
  - [Event Lifecycle](#event-lifecycle)
  - [Supported Events](#supported-events)
    - [Player Events](#player-events)
    - [Match Events](#match-events)
    - [Statistics Events](#statistics-events)
- [Ranking System](#ranking-system)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Game Configuration](#game-configuration)
- [Testing](#testing)
  - [Test Suite Overview](#test-suite-overview)
  - [Testing Utilities](#testing-utilities)
- [Monitoring & Operations](#monitoring--operations)
  - [Health Checks](#health-checks)
  - [Metrics](#metrics)
  - [Logging](#logging)
- [Production Deployment](#production-deployment)
  - [Docker Support](#docker-support)
  - [Scaling Considerations](#scaling-considerations)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Key Features

- **Queue-First Architecture**: RabbitMQ-based event processing for reliability and horizontal scaling
- **ELO-Based Ranking System**: Sophisticated skill tracking with weapon multipliers and dynamic K-factors
- **Multi-Game Support**: Extensible parser framework supporting cstrike/csgo, with more games planned
- **Production-Ready**: Comprehensive error handling, metrics, health checks, and observability
- **Type-Safe**: 100% TypeScript with strict mode, zero `any` types
- **Battle-Tested**: 800+ tests with extensive coverage of critical paths

## Architecture Overview

### Event-Driven Processing Pipeline

```
Game Servers → UDP Ingress → Event Parser → RabbitMQ → Event Processor → Business Logic → Database
     ↓              ↓             ↓            ↓             ↓                ↓              ↓
   [Logs]        [Parse]      [Validate]    [Queue]      [Consume]        [Process]      [Persist]
```

### Core Components

- **UDP Ingress Service**: High-performance packet handling with server authentication and rate limiting
- **Event Parser System**: Game-specific parsers with extensible framework (CS 1.6, CSGO, CS2)
- **Message Queue (RabbitMQ)**: Reliable event distribution with retry logic
- **Event Processor**: Modular handlers for different event types
- **Business Services**: Player, Weapon, Match, Ranking, Server, and Options management
- **RCON Integration**: Multi-protocol RCON support (GoldSrc, Source) for server monitoring
- **GeoIP Service**: IP geolocation using MaxMind GeoLite database integration
- **Infrastructure Layer**: Shared patterns for repositories, event handling, and observability

### Architectural Patterns

- **Domain-Driven Design**: Clear module boundaries with focused responsibilities
- **Repository Pattern**: Consistent database access with transaction support
- **Event Coordinator Pattern**: Cross-module orchestration for complex workflows
- **Module Registry**: Dynamic handler registration and lifecycle management
- **Factory Pattern**: Standardized object creation with dependency injection (Server, Config, Infrastructure)
- **Orchestrator Pattern**: High-level business workflow coordination
- **Builder Pattern**: Fluent APIs for complex object construction (StatUpdateBuilder, PlayerNameUpdateBuilder)
- **Enricher Pattern**: Data augmentation services (GeoIP location enrichment)
- **Validator Pattern**: Input validation and sanitization across application layers

## Server Authentication

The daemon implements a sophisticated server authentication system supporting both Docker-based and external game servers with intelligent discovery and caching mechanisms.

### Docker Server Support

Docker servers are automatically detected and authenticated using network analysis:

- **Network Detection**: Automatic detection of Docker bridge networks (`172.16.0.0/16` - `172.31.255.255/16`, `10.0.0.0/8`)
- **Intelligent Matching**: Maps Docker container IPs to pre-configured server records in the database
- **Connection Types**: Database records with `connectionType: "docker"` are matched to incoming Docker traffic
- **Rate-Limited Logging**: Prevents log spam with intelligent message throttling (5-minute cooldowns)

```typescript
// Docker servers are configured in the database
{
  connectionType: "docker",
  dockerHost: "localhost", 
  address: "172.17.0.2", // Docker bridge IP
  port: 27015,
  game: "cstrike"
}
```

### External Server Authentication

External servers require exact address and port matching:

- **Database Lookup**: Direct IP:port matching against server records
- **Caching Layer**: In-memory authentication cache for performance
- **Validation**: Comprehensive address and port validation with security checks
- **Automatic Registration**: Servers can be auto-created with proper configuration seeding

### Development Mode

Development environments support bypass authentication for rapid testing:

- **Skip Authentication**: `skipAuth: true` bypasses database validation
- **Development Sentinel**: Special server ID for dev environments (`-1`)
- **Flexible Game Detection**: Defaults to configurable game type for development

```typescript
// Authentication flow
const serverId = await authenticator.authenticateServer(address, port);
if (serverId === null) {
  // Server not authorized - reject connection
} else if (serverId === INGRESS_CONSTANTS.DEV_AUTH_SENTINEL) {
  // Development mode - allow with default configuration
} else {
  // Production server - use database configuration
}
```

## Development

### Quick Start

```bash
# Install dependencies
pnpm install

# Start development server (hot reload)
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm check-types

# Linting
pnpm lint

# Build for production
pnpm build
```

### Project Structure

```
apps/daemon/
├── src/
│   ├── modules/              # Feature modules (self-contained domains)
│   │   ├── player/           # Player lifecycle and statistics
│   │   │   ├── handlers/     # Event handlers for player actions
│   │   │   └── resolvers/    # Player resolution utilities
│   │   ├── weapon/           # Weapon statistics and multipliers
│   │   ├── match/            # Round and match state management
│   │   ├── ranking/          # ELO-based skill calculations
│   │   ├── server/           # Game server management
│   │   │   ├── factories/    # Server creation with defaults
│   │   │   ├── orchestrators/# Server discovery workflows
│   │   │   ├── enrichers/    # GeoIP location enrichment
│   │   │   └── seeders/      # Default configuration seeding
│   │   ├── action/           # Game actions and achievements
│   │   ├── ingress/          # UDP server and log parsing
│   │   │   ├── adapters/     # Server authentication
│   │   │   ├── factories/    # Dependency injection
│   │   │   └── parsers/      # Game log parsers
│   │   ├── rcon/             # RCON server monitoring
│   │   │   ├── protocols/    # GoldSrc/Source RCON protocols
│   │   │   ├── parsers/      # Status command parsers
│   │   │   └── handlers/     # Response handling
│   │   ├── geoip/            # IP geolocation services
│   │   └── options/          # Configuration management
│   ├── shared/               # Shared infrastructure
│   │   ├── application/      # Business logic patterns
│   │   │   ├── factories/    # Infrastructure component creation
│   │   │   ├── orchestrators/# High-level business workflows
│   │   │   ├── utils/        # Business utilities (builders, calculators)
│   │   │   └── validators/   # Input validation and sanitization
│   │   ├── infrastructure/   # Technical patterns
│   │   │   ├── messaging/    # Event bus and queue management
│   │   │   ├── modules/      # Module registry and base classes
│   │   │   ├── observability/# Metrics and monitoring
│   │   │   └── persistence/  # Repository patterns
│   │   └── types/            # Shared type definitions
│   ├── config/               # Game and weapon configurations
│   ├── database/             # Database client wrapper
│   └── main.ts               # Application entry point
├── docs/                     # Architecture and feature documentation
├── tests/                    # Test fixtures and utilities
└── scripts/                  # Development and testing scripts
```

## Event Processing

### Event Lifecycle

Events flow through five distinct stages, each with specific logging and metrics:

1. **EMIT** - Raw log parsed into structured event
2. **PUBLISHED** - Event written to RabbitMQ queue
3. **RECEIVED** - Event consumed from queue
4. **PROCESSING** - Business logic execution begins
5. **PROCESSED** - All handlers complete successfully

See [`docs/EVENT_LIFECYCLE.md`](./docs/EVENT_LIFECYCLE.md) for detailed tracing information.

### Supported Events

#### Player Events

- Connect/Disconnect with Steam ID tracking
- Kills/Deaths with weapon and headshot tracking
- Suicides and teamkills with appropriate penalties
- Chat messages with team context

#### Match Events

- Round start/end with timing
- Team victories and scoring
- Map changes and rotations

#### Statistics Events

- Real-time skill rating updates
- Weapon usage statistics
- Player streak tracking

## Ranking System

The daemon implements a sophisticated ELO-based rating system:

- **Dynamic K-Factor**: Adjusts based on player experience (new players: 48, veterans: 25.6)
- **Weapon Multipliers**: AWP (1.4×), AK-47 (1.0×), Knife (2.0×)
- **Headshot Bonus**: 20% rating bonus for precision
- **Skill Bounds**: 100 (floor) to 3000 (ceiling)

See [`docs/features/PLAYER_RANKINGS.md`](./docs/features/PLAYER_RANKINGS.md) for the complete mathematical model.

## Configuration

### Environment Variables

```env
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL=mysql://user:pass@localhost:3306/hlstats
RABBITMQ_URL=amqp://localhost
UDP_PORT=27500
```

### Game Configuration

Games are configured in `src/config/game.config.ts`:

```typescript
{
  code: 'csgo',
  name: 'Counter-Strike: Global Offensive',
  aliases: ['cstrike', 'cs2'],
  logBots: false,
  logChat: true,
  supportsRounds: true
}
```

## Testing

### Test Suite Overview

- **Unit Tests**: Service logic, parsers, and utilities
- **Integration Tests**: End-to-end event processing
- **Type Tests**: Contract stability and type safety

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test player.service.test.ts

# Run with coverage
pnpm test:coverage

# Run integration tests only
pnpm test tests/integration
```

### Testing Utilities

- Mock factories for all domain objects
- Test fixtures for common scenarios
- Shadow consumer for queue inspection

## Monitoring & Operations

### Health Checks

```typescript
GET /health
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "rabbitmq": "connected",
    "udp": "listening"
  }
}
```

### Metrics

The daemon exposes Prometheus metrics:

- `hlstats_events_processed_total` - Events by type and status
- `hlstats_processing_duration_seconds` - Processing time histograms
- `hlstats_queue_depth` - Current queue backlog
- `hlstats_active_players` - Currently connected players

### Logging

Structured logging with correlation IDs:

```typescript
{
  "level": "info",
  "message": "Event processed: PLAYER_KILL",
  "eventId": "evt_123",
  "correlationId": "corr_456",
  "serverId": 1,
  "processingTimeMs": 45,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Production Deployment

### Docker Support

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
CMD ["pnpm", "start"]
```

### Scaling Considerations

- **Horizontal Scaling**: Multiple daemon instances via RabbitMQ consumers
- **Database Pooling**: Configurable connection limits
- **Queue Prefetch**: Tunable message consumption rate
- **Memory Management**: ~200MB per instance under load

## Documentation

### Architecture & Features
- [`docs/MIGRATION.md`](./docs/MIGRATION.md) - Migration progress from Perl daemon
- [`docs/EVENT_LIFECYCLE.md`](./docs/EVENT_LIFECYCLE.md) - Detailed event flow documentation
- [`docs/features/EVENT_QUEUE.md`](./docs/features/EVENT_QUEUE.md) - RabbitMQ integration design
- [`docs/features/PLAYER_RANKINGS.md`](./docs/features/PLAYER_RANKINGS.md) - Complete ranking system guide

### Implementation Patterns
- [`src/shared/application/README.md`](./src/shared/application/README.md) - Application layer patterns (factories, orchestrators, validators, builders)
- [`src/shared/infrastructure/README.md`](./src/shared/infrastructure/README.md) - Infrastructure patterns (messaging, persistence, observability)

### Core Services
- **Server Authentication**: Database-driven server discovery with Docker network detection (`src/modules/ingress/adapters/`)
- **RCON Integration**: Multi-protocol server monitoring and status parsing (`src/modules/rcon/`)
- **GeoIP Services**: MaxMind GeoLite database integration for location enrichment (`src/modules/geoip/`)
- **Configuration Management**: Cached options service for dynamic configuration (`src/modules/options/`)

## Contributing

1. Follow TypeScript best practices (strict mode, no `any`)
2. Write tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting PRs

## License

Part of the HLStatsNext project. See root repository for license information.
