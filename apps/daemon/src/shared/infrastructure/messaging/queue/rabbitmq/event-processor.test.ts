/**
 * RabbitMQ Event Processor Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { RabbitMQEventProcessor } from "./event-processor"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventCoordinator } from "@/shared/application/event-coordinator"
import type { ModuleRegistry } from "@/shared/infrastructure/modules/registry"
import type { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"

// Mock the message utils
vi.mock("@/shared/infrastructure/messaging/queue/utils/message-utils", () => ({
  generateMessageId: vi.fn().mockReturnValue("generated-msg-123"),
  generateCorrelationId: vi.fn().mockReturnValue("generated-corr-456"),
}))

describe("RabbitMQEventProcessor", () => {
  let processor: RabbitMQEventProcessor
  let mockLogger: ILogger
  let mockModuleRegistry: ModuleRegistry
  let mockCoordinators: EventCoordinator[]

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      queue: vi.fn(),
    } as unknown as ILogger

    mockModuleRegistry = {
      getHandlersForEvent: vi.fn().mockReturnValue([]),
      registerHandler: vi.fn(),
      getAllHandlers: vi.fn().mockReturnValue([]),
    } as unknown as ModuleRegistry

    mockCoordinators = []

    processor = new RabbitMQEventProcessor(mockLogger, mockModuleRegistry, mockCoordinators)
  })

  describe("Event Processing", () => {
    it("should process event with existing eventId and correlationId", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "existing-event-123",
        correlationId: "existing-corr-456",
        serverId: 1,
        timestamp: new Date(),
        data: { killerId: 1, victimId: 2 },
      }

      await processor.processEvent(event)

      expect(mockLogger.queue).toHaveBeenCalledWith(
        "Processing event: PLAYER_KILL (Server ID: 1)",
        {
          eventId: "existing-event-123",
          correlationId: "existing-corr-456",
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
        },
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Event processed: PLAYER_KILL (Server ID: 1, Event ID: "),
        expect.objectContaining({
          eventId: "existing-event-123",
          correlationId: "existing-corr-456",
          serverId: 1,
          processingTimeMs: expect.any(Number),
          status: "success",
        }),
      )
    })

    it("should generate eventId and correlationId if missing", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        data: { playerId: 123 },
      }

      await processor.processEvent(event)

      expect(mockLogger.queue).toHaveBeenCalledWith(
        "Processing event: PLAYER_CONNECT (Server ID: 1)",
        expect.objectContaining({
          eventId: expect.any(String),
          correlationId: expect.any(String),
          eventType: EventType.PLAYER_CONNECT,
          serverId: 1,
        }),
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Event processed: PLAYER_CONNECT (Server ID: 1, Event ID: "),
        expect.objectContaining({
          eventId: expect.any(String),
          correlationId: expect.any(String),
        }),
      )
    })

    it("should handle processing errors", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        correlationId: "test-corr-456",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      const mockHandler = {
        name: "TestHandler",
        handledEvents: [EventType.PLAYER_KILL],
        handler: {
          handlePlayerKill: vi.fn().mockRejectedValue(new Error("Handler failed")),
        } as unknown as BaseModuleEventHandler,
      }

      vi.mocked(mockModuleRegistry.getHandlersForEvent).mockReturnValue([mockHandler])

      await expect(processor.processEvent(event)).rejects.toThrow("Handler failed")

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Event processing failed: PLAYER_KILL (Server ID: 1)",
        expect.objectContaining({
          eventId: "test-event-123",
          correlationId: "test-corr-456",
          serverId: 1,
          processingTimeMs: expect.any(Number),
          status: "failed",
          error: "Handler failed",
        }),
      )
    })
  })

  describe("Module Handler Processing", () => {
    it("should process event through module handlers", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: { killerId: 1, victimId: 2 },
      }

      const mockHandlerMethod = vi.fn().mockResolvedValue(undefined)
      const mockHandler = {
        name: "PlayerHandler",
        handledEvents: [EventType.PLAYER_KILL],
        handler: {
          handlePlayerKill: mockHandlerMethod,
        } as unknown as BaseModuleEventHandler,
      }

      vi.mocked(mockModuleRegistry.getHandlersForEvent).mockReturnValue([mockHandler])

      await processor.processEvent(event)

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Processing event: PLAYER_KILL through [PlayerHandler] module handlers",
        {
          eventId: "test-event-123",
          handlers: ["PlayerHandler"],
        },
      )

      expect(mockHandlerMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          eventId: "test-event-123",
          serverId: 1,
          data: { killerId: 1, victimId: 2 },
          correlationId: expect.any(String),
        }),
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Module PlayerHandler processed event PLAYER_KILL successfully"),
      )
    })

    it("should process event through multiple module handlers", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      const mockHandler1Method = vi.fn().mockResolvedValue(undefined)
      const mockHandler2Method = vi.fn().mockResolvedValue(undefined)

      const mockHandler1 = {
        name: "PlayerHandler",
        handledEvents: [EventType.PLAYER_KILL],
        handler: {
          handlePlayerKill: mockHandler1Method,
        } as unknown as BaseModuleEventHandler,
      }

      const mockHandler2 = {
        name: "StatsHandler",
        handledEvents: [EventType.PLAYER_KILL],
        handler: {
          handlePlayerKill: mockHandler2Method,
        } as unknown as BaseModuleEventHandler,
      }

      vi.mocked(mockModuleRegistry.getHandlersForEvent).mockReturnValue([
        mockHandler1,
        mockHandler2,
      ])

      await processor.processEvent(event)

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Processing event: PLAYER_KILL through [PlayerHandler, StatsHandler] module handlers",
        {
          eventId: "test-event-123",
          handlers: ["PlayerHandler", "StatsHandler"],
        },
      )

      expect(mockHandler1Method).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          eventId: "test-event-123",
          serverId: 1,
          correlationId: expect.any(String),
        }),
      )
      expect(mockHandler2Method).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          eventId: "test-event-123",
          serverId: 1,
          correlationId: expect.any(String),
        }),
      )
    })

    it("should handle missing handler methods", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      const mockHandler = {
        name: "IncompleteHandler",
        handledEvents: [EventType.PLAYER_KILL],
        handler: {} as unknown as BaseModuleEventHandler, // No handlePlayerKill method
      }

      vi.mocked(mockModuleRegistry.getHandlersForEvent).mockReturnValue([mockHandler])

      await processor.processEvent(event)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No handler method found in IncompleteHandler for event PLAYER_KILL",
      )
    })

    it("should handle module handler errors", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      const handlerError = new Error("Handler processing failed")
      const mockHandler = {
        name: "FailingHandler",
        handledEvents: [EventType.PLAYER_KILL],
        handler: {
          handlePlayerKill: vi.fn().mockRejectedValue(handlerError),
        } as unknown as BaseModuleEventHandler,
      }

      vi.mocked(mockModuleRegistry.getHandlersForEvent).mockReturnValue([mockHandler])

      await expect(processor.processEvent(event)).rejects.toThrow("Handler processing failed")

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Module FailingHandler failed to process event PLAYER_KILL"),
        expect.objectContaining({
          eventId: "test-event-123",
          moduleName: "FailingHandler",
          error: "Handler processing failed",
          processingTimeMs: expect.any(Number),
        }),
      )
    })

    it("should warn when no module handlers found", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      vi.mocked(mockModuleRegistry.getHandlersForEvent).mockReturnValue([])

      await processor.processEvent(event)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No module handlers found for event type PLAYER_KILL",
      )
    })

    it("should handle different event types correctly", async () => {
      const chatEvent: BaseEvent = {
        eventType: EventType.CHAT_MESSAGE,
        eventId: "chat-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: { message: "Hello world", playerId: 123 },
      }

      const mockChatHandler = vi.fn().mockResolvedValue(undefined)
      const mockHandler = {
        name: "ChatHandler",
        handledEvents: [EventType.CHAT_MESSAGE],
        handler: {
          handleChatMessage: mockChatHandler,
        } as unknown as BaseModuleEventHandler,
      }

      vi.mocked(mockModuleRegistry.getHandlersForEvent).mockReturnValue([mockHandler])

      await processor.processEvent(chatEvent)

      expect(mockChatHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.CHAT_MESSAGE,
          eventId: "chat-event-123",
          serverId: 1,
          data: { message: "Hello world", playerId: 123 },
          correlationId: expect.any(String),
        }),
      )
    })
  })

  describe("Coordinator Processing", () => {
    it("should process event through coordinators", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      const mockCoordinator = {
        coordinateEvent: vi.fn().mockResolvedValue(undefined),
      } as unknown as EventCoordinator

      const processorWithCoordinators = new RabbitMQEventProcessor(mockLogger, mockModuleRegistry, [
        mockCoordinator,
      ])

      await processorWithCoordinators.processEvent(event)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Processing event: PLAYER_KILL through ["),
        expect.objectContaining({
          eventId: "test-event-123",
          coordinators: expect.arrayContaining([expect.any(String)]),
        }),
      )

      expect(mockCoordinator.coordinateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          eventId: "test-event-123",
          serverId: 1,
          correlationId: expect.any(String),
        }),
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("processed event PLAYER_KILL successfully"),
      )
    })

    it("should process event through multiple coordinators", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      const mockCoordinator1 = {
        coordinateEvent: vi.fn().mockResolvedValue(undefined),
      } as unknown as EventCoordinator

      const mockCoordinator2 = {
        coordinateEvent: vi.fn().mockResolvedValue(undefined),
      } as unknown as EventCoordinator

      const processorWithCoordinators = new RabbitMQEventProcessor(mockLogger, mockModuleRegistry, [
        mockCoordinator1,
        mockCoordinator2,
      ])

      await processorWithCoordinators.processEvent(event)

      expect(mockCoordinator1.coordinateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          eventId: "test-event-123",
          serverId: 1,
          correlationId: expect.any(String),
        }),
      )
      expect(mockCoordinator2.coordinateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          eventId: "test-event-123",
          serverId: 1,
          correlationId: expect.any(String),
        }),
      )
    })

    it("should handle coordinator errors", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      const coordinatorError = new Error("Coordinator failed")
      const mockCoordinator = {
        coordinateEvent: vi.fn().mockRejectedValue(coordinatorError),
      } as unknown as EventCoordinator

      const processorWithCoordinators = new RabbitMQEventProcessor(mockLogger, mockModuleRegistry, [
        mockCoordinator,
      ])

      await expect(processorWithCoordinators.processEvent(event)).rejects.toThrow(
        "Coordinator failed",
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("failed for event PLAYER_KILL"),
        expect.objectContaining({
          eventId: "test-event-123",
          coordinatorName: expect.any(String),
          error: "Coordinator failed",
        }),
      )
    })

    it("should skip coordinator processing when no coordinators", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await processor.processEvent(event)

      // Should not log any coordinator processing debug messages
      expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining("coordinators"))
    })
  })

  describe("Performance Tracking", () => {
    it("should track processing time", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await processor.processEvent(event)

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Event processed: PLAYER_KILL (Server ID: 1, Event ID: "),
        expect.objectContaining({
          processingTimeMs: expect.any(Number),
        }),
      )
    })

    it("should track processing time on errors", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      const mockHandler = {
        name: "FailingHandler",
        handledEvents: [EventType.PLAYER_KILL],
        handler: {
          handlePlayerKill: vi.fn().mockRejectedValue(new Error("Processing failed")),
        } as unknown as BaseModuleEventHandler,
      }

      vi.mocked(mockModuleRegistry.getHandlersForEvent).mockReturnValue([mockHandler])

      await expect(processor.processEvent(event)).rejects.toThrow("Processing failed")

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Event processing failed: PLAYER_KILL (Server ID: 1)",
        expect.objectContaining({
          processingTimeMs: expect.any(Number),
        }),
      )
    })
  })

  describe("Event Type Handling", () => {
    it("should handle snake_case event types correctly", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CHANGE_TEAM,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      const mockHandler = {
        name: "PlayerHandler",
        handledEvents: [EventType.PLAYER_CHANGE_TEAM],
        handler: {
          handlePlayerChangeTeam: vi.fn().mockResolvedValue(undefined),
          logger: {} as ILogger,
          destroy: vi.fn(),
        } as unknown as BaseModuleEventHandler,
      }

      vi.mocked(mockModuleRegistry.getHandlersForEvent).mockReturnValue([mockHandler])

      await processor.processEvent(event)

      expect(
        (mockHandler.handler as unknown as Record<string, ReturnType<typeof vi.fn>>)
          .handlePlayerChangeTeam,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_CHANGE_TEAM,
          eventId: "test-event-123",
          serverId: 1,
          correlationId: expect.any(String),
        }),
      )
    })

    it("should handle complex event type names", async () => {
      const event: BaseEvent = {
        eventType: EventType.ACTION_PLAYER_PLAYER,
        eventId: "test-event-123",
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      const mockHandler = {
        name: "ActionHandler",
        handledEvents: [EventType.ACTION_PLAYER_PLAYER],
        handler: {
          handleActionPlayerPlayer: vi.fn().mockResolvedValue(undefined),
          logger: {} as ILogger,
          destroy: vi.fn(),
        } as unknown as BaseModuleEventHandler,
      }

      vi.mocked(mockModuleRegistry.getHandlersForEvent).mockReturnValue([mockHandler])

      await processor.processEvent(event)

      expect(
        (mockHandler.handler as unknown as Record<string, ReturnType<typeof vi.fn>>)
          .handleActionPlayerPlayer,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.ACTION_PLAYER_PLAYER,
          eventId: "test-event-123",
          serverId: 1,
          correlationId: expect.any(String),
        }),
      )
    })
  })
})
