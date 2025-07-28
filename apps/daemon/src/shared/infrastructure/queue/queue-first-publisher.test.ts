/**
 * Queue-First Publisher Tests
 *
 * Tests for the queue-first event publishing logic that gradually migrates
 * from EventBus to RabbitMQ queue-only processing.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import type { MockedFunction } from "vitest"
import { QueueFirstPublisher } from "./queue-first-publisher"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { IEventPublisher } from "./queue.types"
import type { ILogger } from "@/shared/utils/logger.types"

// Mock logger
const mockLogger: ILogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  queue: vi.fn(),
} as unknown as ILogger

// Mock queue publisher
const mockQueuePublisher: IEventPublisher = {
  publish: vi.fn(),
  publishBatch: vi.fn(),
}

// Mock EventBus
const mockEventBus: IEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  clearHandlers: vi.fn(),
  getStats: vi.fn().mockReturnValue({
    totalHandlers: 0,
    handlersByType: new Map(),
    eventsEmitted: 0,
    errors: 0,
  }),
}

// Test event factory
function createTestEvent(eventType: EventType): BaseEvent {
  return {
    eventType,
    timestamp: new Date(),
    serverId: 1,
    eventId: "test-event-id",
    correlationId: "test-correlation-id",
  }
}

describe("QueueFirstPublisher", () => {
  let publisher: QueueFirstPublisher
  let mockQueuePublish: MockedFunction<typeof mockQueuePublisher.publish>
  let mockEventBusEmit: MockedFunction<typeof mockEventBus.emit>

  beforeEach(() => {
    vi.clearAllMocks()
    mockQueuePublish = mockQueuePublisher.publish as MockedFunction<typeof mockQueuePublisher.publish>
    mockEventBusEmit = mockEventBus.emit as MockedFunction<typeof mockEventBus.emit>
    
    publisher = new QueueFirstPublisher(
      mockQueuePublisher,
      mockLogger,
      mockEventBus,
    )
  })

  describe("initialization", () => {
    it("should initialize with correct logging", () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Queue-first publisher initialized",
        expect.objectContaining({
          hasQueuePublisher: true,
          hasEventBusFallback: true,
          queueOnlyEvents: expect.any(Number),
          eventBusFallbackEvents: expect.any(Number),
        }),
      )
    })

    it("should work without EventBus fallback", () => {
      const publisherWithoutFallback = new QueueFirstPublisher(
        mockQueuePublisher,
        mockLogger,
      )

      expect(publisherWithoutFallback).toBeDefined()
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Queue-first publisher initialized",
        expect.objectContaining({
          hasEventBusFallback: false,
        }),
      )
    })
  })

  describe("queue-only events (Phase 1, 2 & 3)", () => {
    const queueOnlyEvents = [
      // Phase 1: Simple events
      EventType.CHAT_MESSAGE,
      EventType.PLAYER_CONNECT,
      EventType.PLAYER_DISCONNECT,
      EventType.PLAYER_CHANGE_NAME,
      EventType.ACTION_PLAYER,
      EventType.ACTION_PLAYER_PLAYER,
      EventType.ACTION_TEAM,
      EventType.ACTION_WORLD,
      EventType.SERVER_STATS_UPDATE,
      EventType.WEAPON_FIRE,
      EventType.WEAPON_HIT,
      
      // Phase 2: Match & Objective events
      EventType.ROUND_START,
      EventType.ROUND_END,
      EventType.TEAM_WIN,
      EventType.MAP_CHANGE,
      EventType.BOMB_PLANT,
      EventType.BOMB_DEFUSE,
      EventType.BOMB_EXPLODE,
      EventType.HOSTAGE_RESCUE,
      EventType.HOSTAGE_TOUCH,
      EventType.FLAG_CAPTURE,
      EventType.FLAG_DEFEND,
      EventType.FLAG_PICKUP,
      EventType.FLAG_DROP,
      EventType.CONTROL_POINT_CAPTURE,
      EventType.CONTROL_POINT_DEFEND,
      
      // Phase 3: Complex events with idempotent sagas
      EventType.PLAYER_KILL,
      EventType.PLAYER_DEATH, 
      EventType.PLAYER_TEAMKILL,
      EventType.PLAYER_SUICIDE,
      EventType.PLAYER_DAMAGE,
    ]

    it.each(queueOnlyEvents)("should publish %s to queue only", async (eventType) => {
      const event = createTestEvent(eventType)

      await publisher.emit(event)

      expect(mockQueuePublish).toHaveBeenCalledWith(event)
      expect(mockEventBusEmit).not.toHaveBeenCalled()
      expect(mockLogger.queue).toHaveBeenCalledWith(
        `Publishing queue-only event ${eventType}`,
        expect.objectContaining({
          eventId: event.eventId,
          serverId: event.serverId,
        }),
      )
    })

    it("should update metrics correctly for queue-only events", async () => {
      const event = createTestEvent(EventType.CHAT_MESSAGE)

      await publisher.emit(event)

      const metrics = publisher.getMetrics()
      expect(metrics.totalEvents).toBe(1)
      expect(metrics.queueOnlyEvents).toBe(1)
      expect(metrics.eventBusFallbackEvents).toBe(0)
      expect(metrics.failedEvents).toBe(0)
      expect(metrics.queueOnlySuccessRate).toBe(100)
    })
  })

  describe("EventBus fallback events", () => {
    const eventBusFallbackEvents = [
      // Final phase: System events
      EventType.SERVER_SHUTDOWN,
      EventType.ADMIN_ACTION,
      
      // Remaining player events
      EventType.PLAYER_ENTRY,
      EventType.PLAYER_CHANGE_TEAM,
      EventType.PLAYER_CHANGE_ROLE,
    ]

    it.each(eventBusFallbackEvents)("should publish %s to EventBus fallback", async (eventType) => {
      const event = createTestEvent(eventType)

      await publisher.emit(event)

      expect(mockEventBusEmit).toHaveBeenCalledWith(event)
      expect(mockQueuePublish).not.toHaveBeenCalled()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Using EventBus fallback for ${eventType}`,
        expect.objectContaining({
          eventId: event.eventId,
          serverId: event.serverId,
        }),
      )
    })

    it("should update metrics correctly for EventBus fallback events", async () => {
      const event = createTestEvent(EventType.SERVER_SHUTDOWN) // Now using actual EventBus fallback event

      await publisher.emit(event)

      const metrics = publisher.getMetrics()
      expect(metrics.totalEvents).toBe(1)
      expect(metrics.queueOnlyEvents).toBe(0)
      expect(metrics.eventBusFallbackEvents).toBe(1)
      expect(metrics.failedEvents).toBe(0)
      expect(metrics.queueOnlySuccessRate).toBe(0)
    })

    it("should throw error when EventBus fallback required but not available", async () => {
      const publisherWithoutFallback = new QueueFirstPublisher(
        mockQueuePublisher,
        mockLogger,
      )
      const event = createTestEvent(EventType.SERVER_SHUTDOWN) // Now using actual EventBus fallback event

      await expect(publisherWithoutFallback.emit(event)).rejects.toThrow(
        "Event SERVER_SHUTDOWN requires EventBus fallback but none provided",
      )
    })
  })

  describe("unknown event types", () => {
    it("should use EventBus fallback for unknown event types", async () => {
      // Create event with a non-existent event type (cast to avoid TS error)
      const event = createTestEvent("UNKNOWN_EVENT" as EventType)

      await publisher.emit(event)

      expect(mockEventBusEmit).toHaveBeenCalledWith(event)
      expect(mockQueuePublish).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Unknown event type, using EventBus fallback",
        expect.objectContaining({
          eventType: "UNKNOWN_EVENT",
          eventId: event.eventId,
        }),
      )
    })
  })

  describe("error handling", () => {
    it("should handle queue publishing errors", async () => {
      const event = createTestEvent(EventType.CHAT_MESSAGE)
      const error = new Error("Queue publish failed")
      mockQueuePublish.mockRejectedValueOnce(error)

      await expect(publisher.emit(event)).rejects.toThrow("Queue publish failed")

      const metrics = publisher.getMetrics()
      expect(metrics.failedEvents).toBe(1)
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to publish event",
        expect.objectContaining({
          eventType: EventType.CHAT_MESSAGE,
          eventId: event.eventId,
          error: "Queue publish failed",
        }),
      )
    })

    it("should handle EventBus fallback errors", async () => {
      const event = createTestEvent(EventType.SERVER_SHUTDOWN) // Now using actual EventBus fallback event
      const error = new Error("EventBus emit failed")
      mockEventBusEmit.mockRejectedValueOnce(error)

      await expect(publisher.emit(event)).rejects.toThrow("EventBus emit failed")

      const metrics = publisher.getMetrics()
      expect(metrics.failedEvents).toBe(1)
    })
  })

  describe("metrics and monitoring", () => {
    it("should track metrics correctly for mixed events", async () => {
      // Publish queue-only events (Phase 1, 2 & 3)
      await publisher.emit(createTestEvent(EventType.CHAT_MESSAGE))
      await publisher.emit(createTestEvent(EventType.PLAYER_CONNECT))
      await publisher.emit(createTestEvent(EventType.ROUND_START)) // Phase 2
      await publisher.emit(createTestEvent(EventType.PLAYER_KILL)) // Phase 3 (now queue-only)
      
      // Publish EventBus fallback events (Final phase)
      await publisher.emit(createTestEvent(EventType.SERVER_SHUTDOWN))

      const metrics = publisher.getMetrics()
      expect(metrics.totalEvents).toBe(5)
      expect(metrics.queueOnlyEvents).toBe(4) // 4 queue-only events  
      expect(metrics.eventBusFallbackEvents).toBe(1) // 1 EventBus fallback
      expect(metrics.failedEvents).toBe(0)
      expect(metrics.queueOnlySuccessRate).toBe(80) // 4/5 * 100
    })

    it("should calculate success rate correctly with failures", async () => {
      // Successful queue-only event
      await publisher.emit(createTestEvent(EventType.CHAT_MESSAGE))
      
      // Failed queue-only event
      mockQueuePublish.mockRejectedValueOnce(new Error("Failed"))
      await expect(publisher.emit(createTestEvent(EventType.PLAYER_CONNECT))).rejects.toThrow()
      
      // Successful EventBus fallback event
      await publisher.emit(createTestEvent(EventType.SERVER_SHUTDOWN)) // Now using actual EventBus fallback event

      const metrics = publisher.getMetrics()
      expect(metrics.totalEvents).toBe(3)
      expect(metrics.queueOnlyEvents).toBe(1)
      expect(metrics.eventBusFallbackEvents).toBe(1)
      expect(metrics.failedEvents).toBe(1)
      expect(metrics.queueOnlySuccessRate).toBe(50) // 1/2 successful events * 100
    })

    it("should handle zero total events gracefully", () => {
      const metrics = publisher.getMetrics()
      expect(metrics.queueOnlySuccessRate).toBe(100)
    })
  })

  describe("migration status", () => {
    it("should provide correct migration status", () => {
      const status = publisher.getMigrationStatus()
      
      expect(status.queueOnlyEvents).toContain(EventType.CHAT_MESSAGE)
      expect(status.queueOnlyEvents).toContain(EventType.PLAYER_CONNECT)
      expect(status.queueOnlyEvents).toContain(EventType.ROUND_START) // Phase 2
      expect(status.queueOnlyEvents).toContain(EventType.PLAYER_KILL) // Phase 3 (now migrated)
      expect(status.eventBusFallbackEvents).toContain(EventType.SERVER_SHUTDOWN)
      expect(status.migrationProgress).toBeGreaterThan(0)
      expect(status.migrationProgress).toBeLessThan(100)
    })

    it("should correctly identify queue-only events", () => {
      expect(publisher.isQueueOnly(EventType.CHAT_MESSAGE)).toBe(true)
      expect(publisher.isQueueOnly(EventType.PLAYER_CONNECT)).toBe(true)
      expect(publisher.isQueueOnly(EventType.ROUND_START)).toBe(true) // Phase 2
      expect(publisher.isQueueOnly(EventType.PLAYER_KILL)).toBe(true) // Phase 3 (now queue-only)
      expect(publisher.isQueueOnly(EventType.SERVER_SHUTDOWN)).toBe(false) // Still EventBus
    })
  })

  describe("migration management", () => {
    it("should log migration requests for EventBus fallback events", () => {
      publisher.migrateEventToQueueOnly(EventType.SERVER_SHUTDOWN)

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Migration requested for event SERVER_SHUTDOWN",
        expect.objectContaining({
          currentStatus: "eventbus_fallback",
          requestedStatus: "queue_only",
          note: "Requires code update to complete migration",
        }),
      )
    })

    it("should warn when trying to migrate already migrated events", () => {
      publisher.migrateEventToQueueOnly(EventType.CHAT_MESSAGE)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event CHAT_MESSAGE is already queue-only",
      )
    })

    it("should warn when trying to migrate unknown events", () => {
      publisher.migrateEventToQueueOnly("UNKNOWN_EVENT" as EventType)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event UNKNOWN_EVENT is not in EventBus fallback set",
      )
    })
  })
})