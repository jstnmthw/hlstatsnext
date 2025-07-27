/**
 * Event Bus Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { EventBus } from "./event-bus"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "../../../tests/mocks/logger"

describe("EventBus", () => {
  let eventBus: EventBus
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()

    eventBus = new EventBus(mockLogger)
  })

  describe("on", () => {
    it("should register event handler and return handler ID", () => {
      const handler = vi.fn()
      const handlerId = eventBus.on(EventType.PLAYER_CONNECT, handler)

      expect(handlerId).toBeDefined()
      expect(handlerId).toMatch(/^PLAYER_CONNECT_\d+_[a-z0-9]+$/)
    })

    it("should register multiple handlers for same event type", () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      const id1 = eventBus.on(EventType.PLAYER_KILL, handler1)
      eventBus.on(EventType.PLAYER_KILL, handler2)

      expect(id1).toBeDefined()
      
      const stats = eventBus.getStats()
      expect(stats.totalHandlers).toBe(2)
      expect(stats.handlersByType.get(EventType.PLAYER_KILL)).toBe(2)
    })

    it("should register handlers for different event types", () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.on(EventType.PLAYER_CONNECT, handler1)
      eventBus.on(EventType.PLAYER_DISCONNECT, handler2)

      const stats = eventBus.getStats()
      expect(stats.totalHandlers).toBe(2)
      expect(stats.handlersByType.get(EventType.PLAYER_CONNECT)).toBe(1)
      expect(stats.handlersByType.get(EventType.PLAYER_DISCONNECT)).toBe(1)
    })
  })

  describe("emit", () => {
    it("should call registered handler for matching event type", async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 123 },
      }

      eventBus.on(EventType.PLAYER_CONNECT, handler)
      await eventBus.emit(event)

      expect(handler).toHaveBeenCalledWith(event)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("should call multiple handlers for same event type", async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined)
      const handler2 = vi.fn().mockResolvedValue(undefined)
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: { killerId: 1, victimId: 2 },
      }

      eventBus.on(EventType.PLAYER_KILL, handler1)
      eventBus.on(EventType.PLAYER_KILL, handler2)
      await eventBus.emit(event)

      expect(handler1).toHaveBeenCalledWith(event)
      expect(handler2).toHaveBeenCalledWith(event)
    })

    it("should not call handlers for different event types", async () => {
      const handler = vi.fn()
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      eventBus.on(EventType.PLAYER_DISCONNECT, handler)
      await eventBus.emit(event)

      expect(handler).not.toHaveBeenCalled()
    })

    it("should handle handler errors gracefully", async () => {
      const error = new Error("Handler failed")
      const failingHandler = vi.fn().mockRejectedValue(error)
      const successHandler = vi.fn().mockResolvedValue(undefined)
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      eventBus.on(EventType.PLAYER_KILL, failingHandler)
      eventBus.on(EventType.PLAYER_KILL, successHandler)
      
      await eventBus.emit(event)

      expect(failingHandler).toHaveBeenCalled()
      expect(successHandler).toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Handler failed")
      )

      const stats = eventBus.getStats()
      expect(stats.errors).toBe(1)
    })

    it("should increment events emitted counter", async () => {
      const handler = vi.fn()
      const event: BaseEvent = {
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      eventBus.on(EventType.ROUND_START, handler)
      
      await eventBus.emit(event)
      await eventBus.emit(event)
      await eventBus.emit(event)

      const stats = eventBus.getStats()
      expect(stats.eventsEmitted).toBe(3)
    })

    it("should log when no handlers are registered", async () => {
      const event: BaseEvent = {
        eventType: EventType.SERVER_SHUTDOWN,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      await eventBus.emit(event)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "No handlers registered for event type: SERVER_SHUTDOWN"
      )
    })
  })

  describe("off", () => {
    it("should unregister handler by ID", () => {
      const handler = vi.fn()
      const handlerId = eventBus.on(EventType.PLAYER_CONNECT, handler)

      let stats = eventBus.getStats()
      expect(stats.totalHandlers).toBe(1)

      eventBus.off(handlerId)

      stats = eventBus.getStats()
      expect(stats.totalHandlers).toBe(0)
    })

    it("should not affect other handlers when unregistering", () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      const id1 = eventBus.on(EventType.PLAYER_KILL, handler1)
      eventBus.on(EventType.PLAYER_KILL, handler2)

      eventBus.off(id1)

      const stats = eventBus.getStats()
      expect(stats.totalHandlers).toBe(1)
      expect(stats.handlersByType.get(EventType.PLAYER_KILL)).toBe(1)
    })

    it("should handle unregistering non-existent handler", () => {
      eventBus.off("non-existent-id")
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Attempted to unregister unknown handler: non-existent-id"
      )
    })
  })

  describe("clearHandlers", () => {
    it("should clear all handlers when no event type specified", () => {
      eventBus.on(EventType.PLAYER_CONNECT, vi.fn())
      eventBus.on(EventType.PLAYER_DISCONNECT, vi.fn())
      eventBus.on(EventType.PLAYER_KILL, vi.fn())

      eventBus.clearHandlers()

      const stats = eventBus.getStats()
      expect(stats.totalHandlers).toBe(0)
      expect(stats.handlersByType.size).toBe(0)
    })

    it("should clear handlers for specific event type", () => {
      eventBus.on(EventType.PLAYER_CONNECT, vi.fn())
      eventBus.on(EventType.PLAYER_CONNECT, vi.fn())
      eventBus.on(EventType.PLAYER_KILL, vi.fn())

      eventBus.clearHandlers(EventType.PLAYER_CONNECT)

      const stats = eventBus.getStats()
      expect(stats.totalHandlers).toBe(1)
      expect(stats.handlersByType.get(EventType.PLAYER_CONNECT)).toBeUndefined()
      expect(stats.handlersByType.get(EventType.PLAYER_KILL)).toBe(1)
    })
  })

  describe("getStats", () => {
    it("should return accurate statistics", async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined)
      const handler2 = vi.fn().mockRejectedValue(new Error("Test error"))
      
      eventBus.on(EventType.PLAYER_CONNECT, handler1)
      eventBus.on(EventType.PLAYER_KILL, handler1)
      eventBus.on(EventType.PLAYER_KILL, handler2)

      const event1: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      const event2: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      await eventBus.emit(event1)
      await eventBus.emit(event2)

      const stats = eventBus.getStats()
      expect(stats.totalHandlers).toBe(3)
      expect(stats.handlersByType.get(EventType.PLAYER_CONNECT)).toBe(1)
      expect(stats.handlersByType.get(EventType.PLAYER_KILL)).toBe(2)
      expect(stats.eventsEmitted).toBe(2)
      expect(stats.errors).toBe(1)
    })
  })
})