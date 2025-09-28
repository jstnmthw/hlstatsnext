# RCON Scheduler

The RCON Scheduler provides automated execution of RCON commands on game servers based on cron-like schedules. It enables administrators to automate routine tasks such as server announcements, statistics collection, and maintenance commands.

## Overview

The scheduler system follows a modular architecture with clear separation of concerns:

- **Service Layer**: Main scheduling logic and job management
- **Command Layer**: Extensible command executors for different types of scheduled tasks
- **Configuration Layer**: Flexible configuration with environment variable support
- **Type System**: Comprehensive TypeScript interfaces for type safety

## Architecture

### Core Components

```
schedulers/
├── rcon-schedule.service.ts    # Main scheduler service
├── README.md                   # This documentation
├── ../commands/scheduled/
│   ├── base-scheduled.command.ts       # Abstract base class
│   ├── server-message.command.ts       # Message announcements
│   └── server-monitoring.command.ts    # Server monitoring and enrichment
├── ../config/
│   └── schedule.config.ts      # Default schedule configurations
└── ../types/
    └── schedule.types.ts       # Type definitions
```

### Service Architecture

```typescript
RconScheduleService
├── Job Management (node-cron integration)
├── Execution Tracking (concurrency, history, stats)
├── Server Filtering (target specific servers)
├── Error Handling (retry logic, failure recovery)
└── Command Execution (delegated to executors)
```

## Features

### ✅ Current Features

- **Cron-based Scheduling**: Full cron expression support for flexible timing
- **Multiple Command Types**: Server messages, stats collection, extensible for more
- **Server Filtering**: Target specific servers by ID, exclude lists, player count, etc.
- **Concurrency Control**: Limit simultaneous executions per server
- **Execution History**: Track success/failure rates and performance metrics
- **Error Handling**: Automatic retry logic with configurable backoff
- **Environment Configuration**: Configurable via environment variables
- **Type Safety**: Full TypeScript support with comprehensive interfaces

### 🔧 Configuration

#### Environment Variables

```bash
# Enable/disable the scheduler
RCON_SCHEDULE_ENABLED=true

# Default command timeout (milliseconds)
RCON_SCHEDULE_DEFAULT_TIMEOUT_MS=30000

# Max concurrent executions per server
RCON_SCHEDULE_MAX_CONCURRENT_PER_SERVER=3

# History retention period (hours)
RCON_SCHEDULE_HISTORY_RETENTION_HOURS=24
```

#### Schedule Configuration

Schedules are defined using the `ScheduledCommand` interface:

```typescript
interface ScheduledCommand {
  id: string // Unique identifier
  name: string // Display name
  cronExpression: string // Cron schedule (e.g., "0 */30 * * * *")
  command: string | ((server: ServerInfo) => string) // Command or function
  enabled: boolean // Enable/disable flag
  serverFilter?: ServerFilter // Optional server targeting
  metadata?: Record<string, unknown> // Optional metadata
}
```

#### Example Schedules

```typescript
// Every 30 minutes server announcement
{
  id: "server-rules-reminder",
  name: "Server Rules Reminder",
  cronExpression: "0 */30 * * * *",
  command: 'say "📋 Type !rules to see server rules"',
  enabled: true
}

// Daily stats snapshot at 6 AM
{
  id: "daily-stats",
  name: "Daily Statistics Snapshot",
  cronExpression: "0 0 6 * * *",
  command: "stats",
  enabled: true,
  serverFilter: {
    includeServerIds: [1, 2, 3],
    minPlayers: 5
  }
}

// Dynamic welcome message
{
  id: "welcome-message",
  name: "Player Welcome",
  cronExpression: "0 */5 * * * *",
  command: (server) => `say "Welcome to ${server.name}! Have fun!"`,
  enabled: true
}
```

## Command Executors

### Base Command Executor

All command executors extend `BaseScheduledCommand`:

```typescript
abstract class BaseScheduledCommand implements IScheduledCommandExecutor {
  // Core execution logic
  abstract execute(context: ScheduleExecutionContext): Promise<ScheduleExecutionResult>

  // Validation hooks
  protected async validateCommand(schedule: ScheduledCommand): Promise<boolean>
  protected validateExecutionContext(context: ScheduleExecutionContext): Promise<void>

  // Processing hooks
  protected async processResponse(
    response: string,
    context: ScheduleExecutionContext,
  ): Promise<string>

  // Event hooks
  protected async onExecutionSuccess(
    result: ScheduleExecutionResult,
    context: ScheduleExecutionContext,
  ): Promise<void>
  protected async onExecutionError(
    error: unknown,
    result: ScheduleExecutionResult,
    context: ScheduleExecutionContext,
  ): Promise<void>

  // Utility methods
  protected getResolvedCommand(schedule: ScheduledCommand, server: ServerInfo): string
  protected serverMatchesFilter(server: ServerInfo, schedule: ScheduledCommand): boolean
}
```

### Built-in Executors

#### Server Message Command

- **Purpose**: Send announcements, warnings, and informational messages
- **Features**:
  - Message formatting with placeholders (`{server.name}`, `{time.hour}`, etc.)
  - Player count filtering
  - Message length validation
  - Quiet hours support

```typescript
// Placeholder examples
'say "Welcome to {server.name}! Time: {time.hour}:{time.minute}"'
'say "Players online: {server.playerCount}/{server.maxPlayers}"'
'say "Today is {date.month}/{date.day}/{date.year}"'
```

#### Stats Snapshot Command

- **Purpose**: Collect server statistics and status information
- **Features**:
  - Server status parsing (players, map, uptime, FPS)
  - Player list extraction
  - Performance metrics tracking
  - Anomaly detection

### Creating Custom Executors

To create a new command executor:

1. **Extend Base Class**:

```typescript
export class CustomCommand extends BaseScheduledCommand {
  protected getCommandType(): string {
    return "custom"
  }
}
```

2. **Implement Required Methods**:

```typescript
async execute(context: ScheduleExecutionContext): Promise<ScheduleExecutionResult> {
  // Your execution logic
  const response = await this.rconService.executeCommand(
    context.server.serverId,
    this.getResolvedCommand(context.schedule, context.server)
  )

  return {
    commandId: context.schedule.id,
    serverId: context.server.serverId,
    success: true,
    response: await this.processResponse(response, context),
    executedAt: new Date(),
    executionTimeMs: Date.now() - startTime
  }
}
```

3. **Register Executor**:

```typescript
// In RconScheduleService.initializeExecutors()
this.executors.set("custom", new CustomCommand(this.logger, this.rconService))
```

## Server Filtering

Control which servers execute schedules using `ServerFilter`:

```typescript
interface ServerFilter {
  includeServerIds?: number[] // Only these servers
  excludeServerIds?: number[] // Exclude these servers
  minPlayers?: number // Minimum player count
  maxPlayers?: number // Maximum player count
  gameTypes?: string[] // Specific game types
  tags?: string[] // Server tags
  quietHours?: {
    // Time-based filtering
    start: string // "22:00"
    end: string // "08:00"
    timezone?: string // "UTC"
  }
}
```

## Usage Examples

### Basic Setup

```typescript
// Initialize the service
const scheduler = new RconScheduleService(logger, rconService, serverService, config)

// Start scheduling
await scheduler.start()

// Register a new schedule
await scheduler.registerSchedule({
  id: "hourly-announcement",
  name: "Hourly Server Message",
  cronExpression: "0 0 * * * *",
  command: 'say "Server restarting in 1 hour for maintenance"',
  enabled: true,
})
```

### Dynamic Management

```typescript
// Get all schedules
const schedules = scheduler.getSchedules()

// Get schedule status
const status = scheduler.getScheduleStatus()

// Enable/disable schedule
await scheduler.setScheduleEnabled("hourly-announcement", false)

// Update existing schedule
await scheduler.updateSchedule({
  id: "hourly-announcement",
  name: "Updated Message",
  cronExpression: "0 0 */2 * * *", // Every 2 hours
  command: 'say "Updated announcement message"',
  enabled: true,
})

// Execute immediately (for testing)
const results = await scheduler.executeScheduleNow("hourly-announcement")

// Unregister schedule
await scheduler.unregisterSchedule("hourly-announcement")
```

### Monitoring

```typescript
// Get execution history
const history = scheduler.getExecutionHistory("hourly-announcement")

// Check performance metrics
status.forEach((schedule) => {
  console.log(`${schedule.name}:`)
  console.log(
    `- Success Rate: ${schedule.successCount}/${schedule.successCount + schedule.failureCount}`,
  )
  console.log(`- Avg Execution Time: ${schedule.averageExecutionTimeMs}ms`)
  console.log(`- Last Executed: ${schedule.lastExecutedAt}`)
  console.log(`- Next Execution: ${schedule.nextExecutionAt}`)
})
```

## Future Extensibility

### 🚀 Planned Features

#### Database Integration

- **Persistent Storage**: Store schedules in database instead of configuration files
- **Web Interface**: CRUD operations via web dashboard
- **Schedule Templates**: Predefined schedule templates for common tasks
- **Audit Logging**: Complete execution history with detailed logs

#### Advanced Scheduling

- **Conditional Execution**: Execute only if certain conditions are met
- **Chain Execution**: Execute sequences of commands
- **Event-Driven Scheduling**: Trigger schedules based on game events
- **Timezone Support**: Per-schedule timezone configuration

#### Enhanced Filtering

- **Player-Based Filtering**: Target servers with specific players online
- **Map-Based Filtering**: Execute only on certain maps
- **Performance-Based**: Skip servers with poor performance
- **Custom Predicates**: User-defined filtering logic

#### Monitoring & Analytics

- **Performance Dashboards**: Real-time execution metrics
- **Alerting System**: Notifications for failures or anomalies
- **Execution Forecasting**: Predict server load from scheduled tasks
- **A/B Testing**: Compare different schedule configurations

#### Command Enhancements

- **Multi-Command Schedules**: Execute multiple commands in sequence
- **Conditional Commands**: Different commands based on server state
- **Template System**: Reusable command templates with parameters
- **Script Integration**: Execute custom scripts via RCON

### Extension Points

#### Custom Executors

```typescript
// Plugin-style executor loading
interface IScheduledCommandPlugin {
  getExecutorType(): string
  createExecutor(dependencies: ExecutorDependencies): IScheduledCommandExecutor
  getConfigSchema(): JSONSchema
}
```

#### Custom Filters

```typescript
// User-defined filtering logic
interface IServerFilterPredicate {
  evaluate(server: ServerInfo, context: FilterContext): Promise<boolean>
}
```

#### Event System

```typescript
// Schedule lifecycle events
interface IScheduleEventListener {
  onScheduleRegistered(schedule: ScheduledCommand): Promise<void>
  onExecutionStarted(context: ScheduleExecutionContext): Promise<void>
  onExecutionCompleted(result: ScheduleExecutionResult): Promise<void>
  onExecutionFailed(error: Error, context: ScheduleExecutionContext): Promise<void>
}
```

### Database Schema (Future)

```sql
-- Schedules table
CREATE TABLE scheduled_commands (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  command TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  server_filter JSON,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Execution history
CREATE TABLE schedule_executions (
  id BIGSERIAL PRIMARY KEY,
  schedule_id VARCHAR(255) REFERENCES scheduled_commands(id),
  server_id INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  response TEXT,
  error_message TEXT,
  execution_time_ms INTEGER,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_schedule_server (schedule_id, server_id),
  INDEX idx_executed_at (executed_at)
);
```

## Best Practices

### Schedule Design

- **Keep commands lightweight**: Avoid long-running operations
- **Use appropriate intervals**: Don't spam servers with frequent messages
- **Test thoroughly**: Use `executeScheduleNow()` for testing
- **Monitor performance**: Check execution times and success rates

### Error Handling

- **Implement retries**: Use built-in retry mechanisms
- **Log appropriately**: Use different log levels for different scenarios
- **Graceful degradation**: Handle server downtime gracefully
- **Alert on failures**: Monitor critical schedule failures

### Performance

- **Limit concurrency**: Use `maxConcurrentPerServer` appropriately
- **Optimize filters**: Efficient server filtering reduces overhead
- **Clean up history**: Configure appropriate retention periods
- **Monitor resource usage**: Watch CPU and memory usage

### Security

- **Validate commands**: Ensure commands are safe to execute
- **Limit permissions**: Use least-privilege RCON accounts
- **Audit changes**: Log all schedule modifications
- **Secure storage**: Protect schedule configurations

## Troubleshooting

### Common Issues

#### Schedules Not Executing

- Check if scheduler is enabled: `RCON_SCHEDULE_ENABLED=true`
- Verify cron expressions: Use tools like crontab.guru
- Check server filters: Ensure servers match filter criteria
- Review RCON connectivity: Verify RCON service status

#### Performance Issues

- Reduce concurrent executions: Lower `maxConcurrentPerServer`
- Optimize command executors: Profile execution time
- Check server health: Monitor target server performance
- Review schedule frequency: Avoid over-scheduling

#### Memory Leaks

- Configure history retention: Set appropriate `historyRetentionHours`
- Monitor job cleanup: Ensure completed jobs are removed
- Check executor cleanup: Verify proper resource disposal

### Debugging

Enable debug logging to troubleshoot issues:

```typescript
// Service-level debugging
this.logger.setLevel("debug")

// Schedule-specific debugging
const history = scheduler.getExecutionHistory(scheduleId)
const status = scheduler.getScheduleStatus().find((s) => s.scheduleId === scheduleId)

console.log("Recent executions:", history.slice(-10))
console.log("Current status:", status)
```

## Contributing

When extending the scheduler:

1. **Follow Architecture**: Use established patterns and interfaces
2. **Maintain Type Safety**: Ensure full TypeScript compliance
3. **Add Tests**: Include unit tests for new functionality
4. **Update Documentation**: Keep README and code comments current
5. **Consider Performance**: Profile and optimize new features

### Code Style

- Follow existing naming conventions
- Use dependency injection for testability
- Implement proper error handling
- Add comprehensive logging
- Maintain low cyclomatic complexity (< 10)

---

_For additional information, see the main RCON module documentation and HLStatsNext architecture guides._
