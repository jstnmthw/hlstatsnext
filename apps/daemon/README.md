# HLStatsNext Daemon

The **HLStatsNext Daemon** is a high-performance, real-time game statistics engine for Half-Life engine games. This modern TypeScript implementation replaces the legacy Perl daemon with a scalable, maintainable, and production-ready microservice architecture.

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
  [Logs]         [Parse]      [Validate]    [Queue]      [Consume]        [Process]      [Persist]
```

### Core Components

- **UDP Ingress Service**: High-performance packet handling with rate limiting
- **Event Parser System**: Game-specific parsers with extensible framework
- **Message Queue (RabbitMQ)**: Reliable event distribution with retry logic
- **Event Processor**: Modular handlers for different event types
- **Business Services**: Player, Weapon, Match, Ranking, and Server management
- **Infrastructure Layer**: Shared patterns for repositories, event handling, and observability

### Architectural Patterns

- **Domain-Driven Design**: Clear module boundaries with focused responsibilities
- **Repository Pattern**: Consistent database access with transaction support
- **Event Coordinator Pattern**: Cross-module orchestration for complex workflows
- **Module Registry**: Dynamic handler registration and lifecycle management

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
│   │   ├── weapon/           # Weapon statistics and multipliers
│   │   ├── match/            # Round and match state management
│   │   ├── ranking/          # ELO-based skill calculations
│   │   ├── server/           # Game server management
│   │   ├── action/           # Game actions and achievements
│   │   └── ingress/          # UDP server and log parsing
│   ├── shared/               # Shared infrastructure
│   │   ├── application/      # Business logic patterns
│   │   ├── infrastructure/   # Technical patterns
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

- [`docs/MIGRATION.md`](./docs/MIGRATION.md) - Migration progress from Perl daemon
- [`docs/EVENT_LIFECYCLE.md`](./docs/EVENT_LIFECYCLE.md) - Detailed event flow documentation
- [`docs/features/EVENT_QUEUE.md`](./docs/features/EVENT_QUEUE.md) - RabbitMQ integration design
- [`docs/features/PLAYER_RANKINGS.md`](./docs/features/PLAYER_RANKINGS.md) - Complete ranking system guide
- [`src/shared/application/README.md`](./src/shared/application/README.md) - Application layer patterns
- [`src/shared/infrastructure/README.md`](./src/shared/infrastructure/README.md) - Infrastructure patterns

## Contributing

1. Follow TypeScript best practices (strict mode, no `any`)
2. Write tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting PRs

## License

Part of the HLStatsNext project. See root repository for license information.
