# RCON Module

The **RCON (Remote Console) Module** provides real-time server status monitoring and command execution for Half-Life engine game servers. It implements a robust connection management system with intelligent retry logic, exponential backoff, and failure tracking to ensure reliable server communication.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Components](#core-components)
- [Retry Logic & Backoff Strategy](#retry-logic--backoff-strategy)
- [Supported Protocols](#supported-protocols)
- [Configuration](#configuration)
- [Server Status Enrichment](#server-status-enrichment)
- [Bot Detection](#bot-detection)
- [Monitoring & Observability](#monitoring--observability)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## Architecture Overview

The RCON module follows a modular, service-oriented architecture with clear separation of concerns:

```
modules/rcon/
├── services/
│   ├── rcon-monitor.service.ts           # Server monitoring orchestration
│   ├── rcon-command.service.ts           # Command execution service
│   ├── retry-backoff-calculator.service.ts # Intelligent retry logic
│   └── rcon.service.ts                   # Core RCON connection management
├── protocols/
│   ├── base-rcon.protocol.ts             # Abstract protocol interface
│   ├── source-rcon.protocol.ts           # Source Engine implementation
│   └── goldsrc-rcon.protocol.ts          # GoldSource Engine implementation
├── parsers/
│   ├── base-status.parser.ts             # Abstract status parser
│   └── goldsrc-status.parser.ts          # GoldSource status parsing
├── commands/
│   ├── status.command.ts                 # Server status command
│   └── base-chat.command.ts              # Chat command interface
├── handlers/
│   ├── command-response.handler.ts       # Response processing
│   └── fragment-response.handler.ts      # Multi-packet response handling
└── rcon.types.ts                         # Type definitions
```

### Design Principles

- **Protocol Abstraction**: Support for multiple RCON protocols (Source, GoldSource) through a common interface
- **Failure Resilience**: Intelligent retry logic with exponential backoff and dormant server management
- **Real-time Monitoring**: Continuous server status tracking with configurable intervals
- **Performance Optimized**: Concurrent connection handling with proper resource management
- **Type Safety**: Comprehensive TypeScript interfaces with strict type checking

## Core Components

### RconService

The central service for managing RCON connections and command execution.

```typescript
import { RconService } from "@/modules/rcon/services/rcon.service"

// Connect to a server
await rconService.connect(serverId)

// Execute commands
const response = await rconService.executeCommand(serverId, "status")

// Get parsed server status
const status = await rconService.getStatus(serverId)

// Check connection status
const isConnected = rconService.isConnected(serverId)
```

### RconMonitorService

Orchestrates periodic monitoring of active servers with intelligent retry logic.

```typescript
import { RconMonitorService } from "@/modules/rcon/services/rcon-monitor.service"

const monitor = new RconMonitorService(context, config, statusEnricher)

// Start monitoring
monitor.start()

// Get retry statistics
const stats = monitor.getRetryStatistics()
console.log(`Dormant servers: ${stats.dormantServers}`)
```

### RetryBackoffCalculatorService

Implements exponential backoff and failure state management.

```typescript
import { RetryBackoffCalculatorService } from "@/modules/rcon/services/retry-backoff-calculator.service"

const calculator = new RetryBackoffCalculatorService(logger, config)

// Check if server should be retried
const failureState = calculator.getFailureState(serverId)
const shouldRetry = calculator.shouldRetry(failureState)

// Record failure
calculator.recordFailure(serverId)

// Reset on success
calculator.resetFailureState(serverId)
```

## Retry Logic & Backoff Strategy

### Failure States

The system tracks three distinct server states:

- **HEALTHY**: Server is connecting successfully (no retry delay)
- **BACKING_OFF**: Server has failed but is within retry limits (exponential backoff)
- **DORMANT**: Server has exceeded failure threshold (long retry interval)

### Backoff Algorithm

The retry system uses exponential backoff with configurable parameters:

```text
Base delay: 30 seconds
Backoff formula: 30 * (multiplier ^ (failures - 1))
Example with multiplier=2:
Failure 1: 30s delay
Failure 2: 60s delay
Failure 3: 120s delay
Failure 4: 240s delay
...capped at maxBackoffMinutes

After maxConsecutiveFailures: dormant state
Dormant retry: every dormantRetryMinutes
```

### State Transitions

```
HEALTHY ──[failure]──> BACKING_OFF ──[max failures]──> DORMANT
   ↑                        ↑                             ↑
   └──[success]─────────────┘                             │
   └──[success after long dormancy]───────────────────────┘
```

## Supported Protocols

### Source Engine (Source RCON)

- **Games**: CS:GO, CS2, Team Fortress 2, Left 4 Dead 2
- **Protocol**: TCP-based with packet authentication
- **Features**: Multi-packet responses, fragment handling
- **Port**: Typically 27015 (configurable)

### GoldSource Engine (Legacy RCON)

- **Games**: Counter-Strike 1.6, Half-Life 1, Day of Defeat
- **Protocol**: UDP-based challenge/response
- **Features**: Single-packet responses, challenge authentication
- **Port**: Same as game port (typically 27015)

## Configuration

### Environment Variables

```bash
# Core RCON Settings
RCON_ENABLED=true                        # Enable/disable RCON functionality
RCON_TIMEOUT=5000                        # Connection timeout (ms)
RCON_MAX_RETRIES=3                       # Max retries per connection attempt
RCON_STATUS_INTERVAL=30000               # Monitoring interval (ms)

# Active Server Discovery
RCON_ACTIVE_SERVER_MAX_AGE_MINUTES=60    # Server activity threshold

# Retry & Backoff Configuration
RCON_MAX_CONSECUTIVE_FAILURES=10         # Failures before dormant state
RCON_BACKOFF_MULTIPLIER=2                # Exponential backoff multiplier
RCON_MAX_BACKOFF_MINUTES=30              # Maximum backoff time
RCON_DORMANT_RETRY_MINUTES=60            # Dormant server retry interval
```

### Service Configuration

```typescript
const rconConfig = {
  enabled: true,
  statusInterval: 30000,
  timeout: 5000,
  maxRetries: 3,
  maxConsecutiveFailures: 10,
  backoffMultiplier: 2,
  maxBackoffMinutes: 30,
  dormantRetryMinutes: 60,
}
```

## Server Status Enrichment

The RCON module enriches server data through periodic status queries:

### Status Information

```typescript
interface ServerStatus {
  map: string // Current map name
  players: number // Total player count
  maxPlayers: number // Server capacity
  realPlayerCount?: number // Human players (excluding bots)
  botCount?: number // Bot count
  hostname?: string // Server name
  uptime: number // Server uptime
  fps: number // Server FPS
  cpu?: number // CPU usage
  version?: string // Game version
  timestamp: Date // Status query time
  playerList?: PlayerInfo[] // Detailed player list
}
```

### Player Information

```typescript
interface PlayerInfo {
  name: string // Player name
  userid: number // User ID
  uniqueid: string // Steam ID or BOT identifier
  isBot: boolean // Bot detection flag
  frag: number // Kill count
  time: string // Connection time
  ping: number // Latency
  loss: number // Packet loss
}
```

## Bot Detection

The system automatically differentiates between human players and bots:

### Detection Methods

1. **Steam ID Pattern**: Bots use predictable ID patterns (`BOT`, numeric sequences)
2. **Name Patterns**: Common bot name prefixes and formats
3. **Ping Values**: Bots typically have 0 or consistent ping values
4. **Connection Time**: Bots often have specific connection timestamps

### Server Configuration

```sql
-- Control bot inclusion in player counts
INSERT INTO servers_config (serverId, parameter, value)
VALUES (1, 'IgnoreBots', '1');  -- Exclude bots from active player count
```

**IgnoreBots Settings:**

- `0` (default): Include bots in player counts
- `1`: Exclude bots from player counts (human players only)

## Monitoring & Observability

### Retry Statistics

```typescript
const stats = monitor.getRetryStatistics()
// Returns:
{
  totalServersInFailureState: 5,
  healthyServers: 0,
  backingOffServers: 3,
  dormantServers: 2
}
```

### Failure State Tracking

```typescript
const failureStates = monitor.getAllFailureStates()
// Returns detailed failure information for all tracked servers
```

### Logging Context

All RCON operations include structured logging with:

```json
{
  "serverId": 123,
  "serverName": "My Game Server",
  "consecutiveFailures": 5,
  "retryStatus": "backing_off",
  "nextRetryAt": "2024-01-15T10:35:00Z",
  "error": "Connection refused"
}
```

### Metrics

The module exposes Prometheus metrics for monitoring:

- `rcon_connections_active`: Active RCON connections
- `rcon_connection_failures_total`: Connection failure counter
- `rcon_servers_backing_off`: Servers in backoff state
- `rcon_servers_dormant`: Servers in dormant state
- `rcon_status_enrichment_duration`: Status query timing

## Troubleshooting

### Common Connection Issues

#### "Connection refused"

- **Cause**: Server RCON port not accessible
- **Solution**: Check firewall, server configuration, port binding

#### "Authentication failed"

- **Cause**: Incorrect RCON password
- **Solution**: Verify `rcon_password` in server config matches database

#### "Connection timeout"

- **Cause**: Network latency or server overload
- **Solution**: Increase `RCON_TIMEOUT` or check network connectivity

#### "Server in dormant state"

- **Cause**: Too many consecutive failures
- **Solution**: Check server status, adjust failure thresholds

### Debug Information

Enable debug logging to troubleshoot issues:

```bash
LOG_LEVEL=debug
```

Debug logs include:

- Connection attempts and results
- Retry calculations and backoff timing
- Status parsing details
- Bot detection decisions

### Recovery Strategies

1. **Manual Reset**: Restart daemon to clear failure states
2. **Configuration Adjustment**: Increase timeout/retry limits
3. **Server Investigation**: Check game server logs and status
4. **Network Diagnosis**: Verify connectivity and firewall rules

## Development

### Adding New Protocols

1. **Create Protocol Class**:

   ```typescript
   export class NewRconProtocol extends BaseRconProtocol {
     async connect(address: string, port: number, password: string): Promise<void> {
       // Implementation
     }
   }
   ```

2. **Register Protocol**:
   ```typescript
   // In rcon.service.ts createProtocol method
   case GameEngine.NEW_ENGINE:
     return new NewRconProtocol(this.logger, this.config.timeout)
   ```

### Adding New Commands

1. **Create Command Class**:

   ```typescript
   export class CustomCommand implements RconCommand {
     name = "custom_cmd"

     async execute(protocol: IRconProtocol): Promise<string> {
       return await protocol.execute(this.name)
     }

     parse(response: string): CustomResult {
       // Parse response
     }
   }
   ```

### Testing

```bash
# Run RCON module tests
pnpm --filter daemon test src/modules/rcon/

# Run specific test file
pnpm --filter daemon test rcon.service.test.ts

# Run with coverage
pnpm --filter daemon test --coverage src/modules/rcon/
```

### Type Safety

The module maintains strict TypeScript compliance:

- No `any` types allowed
- Comprehensive interfaces for all data structures
- Proper error handling with custom error classes
- Generic types for protocol abstraction

---

## Contributing

When contributing to the RCON module:

1. **Follow Architecture**: Maintain clear separation between services, protocols, and parsers
2. **Add Tests**: Include unit tests for new functionality
3. **Update Types**: Maintain type definitions in `rcon.types.ts`
4. **Document Changes**: Update this README for new features
5. **Performance**: Consider connection pooling and resource usage
6. **Security**: Validate all input and handle credentials securely

## License

Part of the HLStatsNext project. See root repository for license information.
