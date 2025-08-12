# Event Lifecycle (Queue-First)

This document outlines the end-to-end flow for game events in the HLStatsNext daemon, focused on the objective events rewrite (DB-first, canonical action codes).

## Table of Contents

- [High-level Flow](#high-level-flow)
- [Objective Events Flow (DB-first)](#objective-events-flow-db-first)
  - [Parsing](#parsing)
  - [Publishing](#publishing)
  - [Processing](#processing)
  - [Match Scoring & Counters](#match-scoring--counters)
  - [Lifecycle](#lifecycle)
- [Rationale](#rationale)
- [Event Lifecycle Documentation](#event-lifecycle-documentation)
- [Event Lifecycle Stages](#event-lifecycle-stages)
  - [🌐 EMIT (Event Creation)](#-emit-event-creation)
  - [📤 PUBLISHED (Queue Publishing)](#-published-queue-publishing)
  - [📥 RECEIVED (Queue Consumption)](#-received-queue-consumption)
  - [⚙️ PROCESSING (Business Logic Start)](#️-processing-business-logic-start)
  - [✅ PROCESSED (Business Logic Complete)](#-processed-business-logic-complete)
- [Log Level Distinction](#log-level-distinction)
  - [QUEUE Logs (Magenta)](#queue-logs-magenta)
  - [INFO Logs (Standard)](#info-logs-standard)
- [Timeline Example](#timeline-example)
- [Debugging Guide](#debugging-guide)
  - [Missing "Emitted" Logs](#missing-emitted-logs)
  - [Missing "Published" Logs](#missing-published-logs)
  - [Missing "Received" Logs](#missing-received-logs)
  - [Missing "Processing" Logs](#missing-processing-logs)
  - [Missing "Processed" Logs](#missing-processed-logs)
- [Performance Monitoring](#performance-monitoring)
  - [Key Metrics](#key-metrics)
  - [Health Indicators](#health-indicators)
- [Architecture Flow](#architecture-flow)

## High-level Flow

1. Ingress (UDP) receives raw server log lines
2. Parser converts lines → structured events
3. Events are published to RabbitMQ with routing keys
4. RabbitMQ consumer dispatches to module handlers via `ModuleRegistry`
5. Handlers persist events and execute business logic
6. Services update in-memory match state and database counters

## Objective Events Flow (DB-first)

- Canonical objective signals (e.g., `Planted_The_Bomb`, `Defused_The_Bomb`, `Target_Bombed`) are forwarded directly by parsers as ACTION\_\* events without enum mapping.

### Parsing

- Player-triggered objective lines:
  - Example: `"X" triggered "Planted_The_Bomb"`
  - Emits: `ACTION_PLAYER`, `data.actionCode = "Planted_The_Bomb"`

- Team-triggered non-win lines:
  - Example: `Team "TERRORIST" triggered "Target_Bombed"`
  - Emits: `ACTION_TEAM`, `data.actionCode = "Target_Bombed"`

- Team wins remain lifecycle events:
  - Example: `Team "CT" triggered "CTs_Win"`
  - Emits: `TEAM_WIN`

### Publishing

- All events are queue-first. ACTION\_\* events use routing keys:
  - `action.player`, `action.player.player`, `action.team`, `action.world`

### Processing

- Action module persists ACTION\_\* to legacy tables via `ActionRepository`.
- Repository resolves `Action` records by `game`+`code` (with in-code alias fallback for csgo/cs2 `SFUI_Notice_*`).
- After persistence, `ActionEventHandler` informs `MatchService`:
  - `matchService.handleObjectiveAction(actionCode, serverId, playerId?, team?)`

### Match Scoring & Counters

- `MatchService` maintains in-memory state per server.
- Objective scoring uses a canonical points map (initial minimal set):
  - `Planted_The_Bomb`: +3
  - `Defused_The_Bomb`: +3
  - `All_Hostages_Rescued`: +2
  - Default: +1
- Bomb statistics updated on server record:
  - `Planted_The_Bomb` → `updateBombStats(serverId, "plant")`
  - `Defused_The_Bomb` → `updateBombStats(serverId, "defuse")`

### Lifecycle

- `ROUND_START/END`, `TEAM_WIN`, `MAP_CHANGE` remain separate events managed by the match module for state and scoreboard updates.

## Rationale

- Removes semantic objective enums from code (prevents drift).
- Database is the single source of truth for actions and rewards.
- Parsers are thin, forwarding canonical trigger strings.

# Event Lifecycle Documentation

This document explains the complete event lifecycle in the HLStats daemon, from raw log parsing to final business logic completion. Understanding these stages is crucial for debugging, monitoring, and performance optimization.

## Event Lifecycle Stages

### 1. 🌐 **EMIT** (Event Creation)

**Location**: `IngressService.handleLogLine()`
**Log Level**: `QUEUE`
**Log Message**: `Event emitted: PLAYER_KILL`

```typescript
// Raw UDP log line received: "L 10/15/2023 - 10:15:32: Player<1><STEAM_1:0:123><CT> killed Player<2><STEAM_1:0:456><T> with ak47"
const event = await this.processRawEvent(logLine.trim(), serverAddress, serverPort)
if (event) {
  await this.eventPublisher.publish(event) // ← Event emitted here
  this.logger.queue(`Event emitted: ${event.eventType}`, {
    eventType: event.eventType,
    serverId: event.serverId,
    eventId: event.eventId,
  })
}
```

**What Happens**:

- Raw log line is parsed by game-specific parser (CS, DOD, etc.)
- Structured event object is created with proper typing
- Event is validated and enriched with metadata
- Event is handed off to the publishing system

**Indicates**: "A raw log line has been successfully parsed into a structured event"

---

### 2. 📤 **PUBLISHED** (Queue Publishing)

**Location**: `EventPublisher.publish()`  
**Log Level**: `QUEUE`  
**Log Message**: `Event published: PLAYER_KILL`

```typescript
// Event is serialized and published to RabbitMQ
const published = await channel.publish(
  "hlstats.events", // Exchange
  routingKey, // Queue routing key
  Buffer.from(JSON.stringify(message)), // Serialized event
  {
    persistent: true,
    priority,
    headers: {
      "x-message-id": message.id,
      "x-event-type": event.eventType,
      "x-server-id": event.serverId,
      "x-routing-key": routingKey,
    },
  },
)

this.logger.queue(`Event published: ${event.eventType}`, {
  messageId: message.id,
  eventType: event.eventType,
  routingKey,
  priority,
  serverId: event.serverId,
})
```

**What Happens**:

- Event is wrapped in queue message format with metadata
- Message is routed to appropriate queue based on priority
- Event is persisted in RabbitMQ for reliable delivery
- Publishing confirmation received from broker

**Indicates**: "The event has been successfully written to the message queue and is waiting to be consumed"

---

### 3. 📥 **RECEIVED** (Queue Consumption)

**Location**: `EventConsumer.handleMessage()`  
**Log Level**: `QUEUE`  
**Log Message**: `Event received: PLAYER_KILL`

```typescript
// Message consumed from RabbitMQ queue
const message = parseResult.data
await this.messageValidator(message)

this.logger.queue(`Event received: ${message.payload.eventType}`, {
  messageId,
  eventType: message.payload.eventType,
  queueName,
  retryCount: message.metadata.routing.retryCount,
})

// Process the event
await this.processor.processEvent(message.payload)
```

**What Happens**:

- Message is dequeued from RabbitMQ
- Message is parsed and validated
- Event payload is extracted from message wrapper
- Event is handed to the processor for business logic

**Indicates**: "The event has been consumed from the queue and is about to enter business logic processing"

---

### 4. ⚙️ **PROCESSING** (Business Logic Start)

**Location**: `RabbitMQEventProcessor.processEvent()`  
**Log Level**: `QUEUE`  
**Log Message**: `Processing event: PLAYER_KILL`

```typescript
// Event processing begins
const processedEvent: BaseEvent = {
  ...event,
  eventId: event.eventId || generateMessageId(),
  correlationId: event.correlationId || generateCorrelationId(),
}

this.logger.queue(`Processing event: ${processedEvent.eventType}`, {
  eventId: processedEvent.eventId,
  correlationId: processedEvent.correlationId,
  eventType: processedEvent.eventType,
  serverId: processedEvent.serverId,
})
```

**What Happens**:

- Event IDs and correlation IDs are ensured
- Event enters the business logic processing pipeline
- Module handlers and coordinators are about to be invoked

**Indicates**: "The event has been received by the processor and business logic execution is starting"

---

### 5. ✅ **PROCESSED** (Business Logic Complete)

**Location**: `RabbitMQEventProcessor.processEvent()`  
**Log Level**: `INFO` (not QUEUE!)  
**Log Message**: `Event processed: PLAYER_KILL`

```typescript
try {
  // Process through module handlers first (for business logic like chat persistence)
  await this.processModuleHandlers(processedEvent)

  // Then process through coordinators (optional)
  await this.processCoordinators(processedEvent)

  const processingTime = Date.now() - startTime
  this.logger.info(`Event processed: ${processedEvent.eventType}`, {
    eventId: processedEvent.eventId,
    correlationId: processedEvent.correlationId,
    serverId: processedEvent.serverId,
    processingTimeMs: processingTime,
    status: "success",
  })
} catch (error) {
  // Error handling...
}
```

**What Happens**:

- **Module Handlers**: Business logic like chat message persistence, player updates
- **Coordinators** (optional): Cross-module orchestration hooks, e.g., batch ranking updates
- All database writes and external API calls complete
- Message is acknowledged to RabbitMQ

**Indicates**: "All business logic has completed successfully and the event is fully processed"

---

## Log Level Distinction

### **QUEUE** Logs (Magenta)

- Infrastructure and transport operations
- Queue publishing, consuming, routing
- Message broker interactions
- Event flow through messaging system

### **INFO** Logs (Standard)

- Business logic completion
- Successful persistence operations
- Application-level milestones
- End-user visible outcomes

## Timeline Example

```
[10:15:32.100] QUEUE Event emitted: PLAYER_KILL     ← Raw log parsed (Ingress)
[10:15:32.102] QUEUE Event published: PLAYER_KILL   ← Written to RabbitMQ (2ms)
[10:15:32.105] QUEUE Event received: PLAYER_KILL    ← Consumed from queue (3ms)
[10:15:32.106] QUEUE Processing event: PLAYER_KILL  ← Business logic starts (1ms)
[10:15:32.125] INFO Event processed: PLAYER_KILL    ← All business logic done (19ms)
```

**Total Time**: 25ms from raw log to completion

## Debugging Guide

### **Missing "Emitted" Logs**

- Check UDP server connectivity
- Verify log parsing logic in game parsers
- Look for authentication failures

### **Missing "Published" Logs**

- Check RabbitMQ connection health
- Verify exchange and queue topology
- Look for publishing errors or timeouts

### **Missing "Received" Logs**

- Check RabbitMQ consumer status
- Verify queue bindings and routing keys
- Look for message validation failures

### **Missing "Processing" Logs**

- Check event processor initialization
- Verify module registry setup
- Look for coordinator startup issues

### **Missing "Processed" Logs**

- Check module handler implementations
- Verify database connectivity
- Look for saga execution failures
- Check coordinator error logs

## Performance Monitoring

### **Key Metrics**

- **Emit Rate**: Events per second from ingress
- **Publish Latency**: Emit → Published time (should be 1-5ms)
- **Queue Depth**: Published - Received events
- **Processing Time**: Processing → Processed duration
- **Success Rate**: Processed / Received ratio

### **Health Indicators**

- **Published count ≈ Processed count** (over time)
- **Low queue depth** (< 1000 messages)
- **Fast processing times** (< 100ms average)
- **High success rate** (> 99%)

## Architecture Flow

```
UDP Logs → Ingress → EventPublisher → RabbitMQ → EventConsumer → EventProcessor → Modules/Sagas → Database
    ↓           ↓            ↓            ↓            ↓             ↓              ↓
  [Parse]   [EMIT]     [PUBLISHED]   [Queued]   [RECEIVED]   [PROCESSING]   [PROCESSED]
```

This lifecycle ensures reliable, traceable, and scalable event processing throughout the HLStats system.
