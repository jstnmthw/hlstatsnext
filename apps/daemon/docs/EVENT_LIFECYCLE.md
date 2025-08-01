# Event Lifecycle Documentation

## Overview

This document explains the complete event lifecycle in the HLStats daemon, from raw log parsing to final business logic completion. Understanding these stages is crucial for debugging, monitoring, and performance optimization.

## Event Lifecycle Stages

### 1. 🌐 **EMIT** (Event Creation)

**Location**: `IngressService.processLogLine()`  
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

  // Then process through coordinators (including sagas)
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
- **Coordinators**: Complex workflows like kill tracking, ranking updates
- **Sagas**: Multi-step business processes like weapon statistics
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
