/**
 * Module Registry Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { ModuleRegistry, type ModuleEventHandler } from "./registry"
import type { BaseModuleEventHandler } from "./event-handler.base"
import type { ILogger } from "@/shared/utils/logger.types"
import { EventType } from "@/shared/types/events"

describe("ModuleRegistry", () => {
  let registry: ModuleRegistry
  let mockLogger: ILogger
  let mockHandler1: BaseModuleEventHandler
  let mockHandler2: BaseModuleEventHandler
  let module1: ModuleEventHandler
  let module2: ModuleEventHandler

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger

    mockHandler1 = {
      destroy: vi.fn(),
    } as unknown as BaseModuleEventHandler

    mockHandler2 = {
      destroy: vi.fn(),
    } as unknown as BaseModuleEventHandler

    module1 = {
      name: "PlayerModule",
      handler: mockHandler1,
      handledEvents: [EventType.PLAYER_KILL, EventType.PLAYER_CONNECT],
    }

    module2 = {
      name: "ChatModule",
      handler: mockHandler2,
      handledEvents: [EventType.CHAT_MESSAGE],
    }

    registry = new ModuleRegistry(mockLogger)
  })

  describe("Module Registration", () => {
    it("should register a module successfully", () => {
      registry.register(module1)

      expect(mockLogger.info).toHaveBeenCalledWith("Registered module handler: PlayerModule", {
        handledEvents: [EventType.PLAYER_KILL, EventType.PLAYER_CONNECT],
      })
      expect(registry.hasModule("PlayerModule")).toBe(true)
    })

    it("should warn when replacing existing module", () => {
      registry.register(module1)
      const duplicateModule = {
        name: "PlayerModule",
        handler: mockHandler2,
        handledEvents: [EventType.PLAYER_DISCONNECT],
      }

      registry.register(duplicateModule)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Module PlayerModule is already registered, replacing",
      )
      expect(registry.getModule("PlayerModule")).toBe(duplicateModule)
    })

    it("should register multiple modules", () => {
      registry.register(module1)
      registry.register(module2)

      expect(registry.hasModule("PlayerModule")).toBe(true)
      expect(registry.hasModule("ChatModule")).toBe(true)
      expect(registry.getAllModules()).toHaveLength(2)
    })
  })

  describe("Module Unregistration", () => {
    beforeEach(() => {
      registry.register(module1)
      registry.register(module2)
    })

    it("should unregister a module successfully", () => {
      registry.unregister("PlayerModule")

      expect(mockHandler1.destroy).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith("Unregistered module handler: PlayerModule")
      expect(registry.hasModule("PlayerModule")).toBe(false)
      expect(registry.hasModule("ChatModule")).toBe(true)
    })

    it("should warn when unregistering unknown module", () => {
      registry.unregister("UnknownModule")

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Attempted to unregister unknown module: UnknownModule",
      )
    })

    it("should not affect other modules when unregistering", () => {
      registry.unregister("PlayerModule")

      expect(mockHandler2.destroy).not.toHaveBeenCalled()
      expect(registry.hasModule("ChatModule")).toBe(true)
    })
  })

  describe("Module Retrieval", () => {
    beforeEach(() => {
      registry.register(module1)
      registry.register(module2)
    })

    it("should get module by name", () => {
      const module = registry.getModule("PlayerModule")

      expect(module).toBe(module1)
      expect(module?.name).toBe("PlayerModule")
    })

    it("should return undefined for unknown module", () => {
      const module = registry.getModule("UnknownModule")

      expect(module).toBeUndefined()
    })

    it("should check if module exists", () => {
      expect(registry.hasModule("PlayerModule")).toBe(true)
      expect(registry.hasModule("ChatModule")).toBe(true)
      expect(registry.hasModule("UnknownModule")).toBe(false)
    })

    it("should get all modules", () => {
      const allModules = registry.getAllModules()

      expect(allModules).toHaveLength(2)
      expect(allModules).toContain(module1)
      expect(allModules).toContain(module2)
    })
  })

  describe("Event Handler Discovery", () => {
    beforeEach(() => {
      registry.register(module1)
      registry.register(module2)
    })

    it("should get handlers for specific event type", () => {
      const handlers = registry.getHandlersForEvent(EventType.PLAYER_KILL)

      expect(handlers).toHaveLength(1)
      expect(handlers[0]).toBe(module1)
    })

    it("should get multiple handlers for same event type", () => {
      const chatModule2 = {
        name: "ChatLoggerModule",
        handler: mockHandler2,
        handledEvents: [EventType.CHAT_MESSAGE, EventType.PLAYER_CONNECT],
      }
      registry.register(chatModule2)

      const chatHandlers = registry.getHandlersForEvent(EventType.CHAT_MESSAGE)
      const connectHandlers = registry.getHandlersForEvent(EventType.PLAYER_CONNECT)

      expect(chatHandlers).toHaveLength(2)
      expect(connectHandlers).toHaveLength(2)
      expect(connectHandlers).toContain(module1)
      expect(connectHandlers).toContain(chatModule2)
    })

    it("should return empty array for unhandled event types", () => {
      const handlers = registry.getHandlersForEvent(EventType.WEAPON_FIRE)

      expect(handlers).toHaveLength(0)
    })

    it("should handle modules with multiple event types", () => {
      const killHandlers = registry.getHandlersForEvent(EventType.PLAYER_KILL)
      const connectHandlers = registry.getHandlersForEvent(EventType.PLAYER_CONNECT)

      expect(killHandlers).toHaveLength(1)
      expect(connectHandlers).toHaveLength(1)
      expect(killHandlers[0]).toBe(module1)
      expect(connectHandlers[0]).toBe(module1)
    })
  })

  describe("Module Initialization", () => {
    it("should initialize all modules successfully", async () => {
      registry.register(module1)
      registry.register(module2)

      await registry.initializeAll()

      expect(mockLogger.info).toHaveBeenCalledWith("Initializing 2 module handlers")
      expect(mockLogger.debug).toHaveBeenCalledWith("Module PlayerModule initialized")
      expect(mockLogger.debug).toHaveBeenCalledWith("Module ChatModule initialized")
      expect(mockLogger.info).toHaveBeenCalledWith("All module handlers initialized successfully")
    })

    it("should initialize empty registry", async () => {
      await registry.initializeAll()

      expect(mockLogger.info).toHaveBeenCalledWith("Initializing 0 module handlers")
      expect(mockLogger.info).toHaveBeenCalledWith("All module handlers initialized successfully")
    })

    it("should handle initialization errors", async () => {
      // Create a module that will throw during initialization
      const errorModule = {
        name: "ErrorModule",
        handler: mockHandler1,
        handledEvents: [EventType.PLAYER_KILL],
      }
      registry.register(errorModule)

      // Since initialization is currently a placeholder, we need to simulate an error scenario
      // For demonstration, we'll mock the logger.debug to throw
      vi.mocked(mockLogger.debug).mockImplementationOnce(() => {
        throw new Error("Initialization failed")
      })

      await expect(registry.initializeAll()).rejects.toThrow("Initialization failed")
      expect(mockLogger.error).toHaveBeenCalledWith("Failed to initialize module ErrorModule", {
        error: "Initialization failed",
      })
    })
  })

  describe("Module Destruction", () => {
    beforeEach(() => {
      registry.register(module1)
      registry.register(module2)
    })

    it("should destroy all modules successfully", async () => {
      await registry.destroyAll()

      expect(mockHandler1.destroy).toHaveBeenCalledTimes(1)
      expect(mockHandler2.destroy).toHaveBeenCalledTimes(1)
      expect(mockLogger.info).toHaveBeenCalledWith("Destroying 2 module handlers")
      expect(mockLogger.debug).toHaveBeenCalledWith("Module PlayerModule destroyed")
      expect(mockLogger.debug).toHaveBeenCalledWith("Module ChatModule destroyed")
      expect(mockLogger.info).toHaveBeenCalledWith("All module handlers destroyed")
      expect(registry.getAllModules()).toHaveLength(0)
    })

    it("should handle destruction errors gracefully", async () => {
      vi.mocked(mockHandler1.destroy).mockImplementation(() => {
        throw new Error("Destroy failed")
      })

      await registry.destroyAll()

      expect(mockLogger.error).toHaveBeenCalledWith("Failed to destroy module PlayerModule", {
        error: "Destroy failed",
      })
      expect(mockHandler2.destroy).toHaveBeenCalledTimes(1) // Should continue with other modules
      expect(registry.getAllModules()).toHaveLength(0) // Registry should still be cleared
    })

    it("should destroy empty registry", async () => {
      const emptyRegistry = new ModuleRegistry(mockLogger)
      await emptyRegistry.destroyAll()

      expect(mockLogger.info).toHaveBeenCalledWith("Destroying 0 module handlers")
      expect(mockLogger.info).toHaveBeenCalledWith("All module handlers destroyed")
    })
  })

  describe("Registry Statistics", () => {
    it("should return empty stats for empty registry", () => {
      const stats = registry.getStats()

      expect(stats).toEqual({
        totalModules: 0,
        moduleNames: [],
        eventCoverage: {},
        duplicateHandlers: [],
      })
    })

    it("should return stats for single module", () => {
      registry.register(module1)
      const stats = registry.getStats()

      expect(stats.totalModules).toBe(1)
      expect(stats.moduleNames).toEqual(["PlayerModule"])
      expect(stats.eventCoverage).toEqual({
        [EventType.PLAYER_KILL]: ["PlayerModule"],
        [EventType.PLAYER_CONNECT]: ["PlayerModule"],
      })
      expect(stats.duplicateHandlers).toHaveLength(0)
    })

    it("should return stats for multiple modules", () => {
      registry.register(module1)
      registry.register(module2)
      const stats = registry.getStats()

      expect(stats.totalModules).toBe(2)
      expect(stats.moduleNames).toContain("PlayerModule")
      expect(stats.moduleNames).toContain("ChatModule")
      expect(stats.eventCoverage[EventType.PLAYER_KILL]).toEqual(["PlayerModule"])
      expect(stats.eventCoverage[EventType.CHAT_MESSAGE]).toEqual(["ChatModule"])
    })

    it("should identify duplicate event handlers", () => {
      const duplicateModule = {
        name: "PlayerModule2",
        handler: mockHandler2,
        handledEvents: [EventType.PLAYER_KILL, EventType.CHAT_MESSAGE],
      }

      registry.register(module1)
      registry.register(module2)
      registry.register(duplicateModule)

      const stats = registry.getStats()

      expect(stats.duplicateHandlers).toHaveLength(2)

      const killDuplicate = stats.duplicateHandlers.find(
        (d) => d.eventType === EventType.PLAYER_KILL,
      )
      const chatDuplicate = stats.duplicateHandlers.find(
        (d) => d.eventType === EventType.CHAT_MESSAGE,
      )

      expect(killDuplicate?.handlers).toContain("PlayerModule")
      expect(killDuplicate?.handlers).toContain("PlayerModule2")
      expect(chatDuplicate?.handlers).toContain("ChatModule")
      expect(chatDuplicate?.handlers).toContain("PlayerModule2")
    })

    it("should handle complex event coverage", () => {
      const complexModule = {
        name: "ComplexModule",
        handler: mockHandler2,
        handledEvents: [
          EventType.PLAYER_KILL,
          EventType.PLAYER_CONNECT,
          EventType.CHAT_MESSAGE,
          EventType.ROUND_START,
        ],
      }

      registry.register(module1)
      registry.register(complexModule)

      const stats = registry.getStats()

      expect(stats.eventCoverage[EventType.PLAYER_KILL]).toHaveLength(2)
      expect(stats.eventCoverage[EventType.PLAYER_CONNECT]).toHaveLength(2)
      expect(stats.eventCoverage[EventType.CHAT_MESSAGE]).toEqual(["ComplexModule"])
      expect(stats.eventCoverage[EventType.ROUND_START]).toEqual(["ComplexModule"])
      expect(stats.duplicateHandlers).toHaveLength(2) // PLAYER_KILL and PLAYER_CONNECT
    })
  })

  describe("Edge Cases", () => {
    it("should handle module with empty event types", () => {
      const emptyModule = {
        name: "EmptyModule",
        handler: mockHandler1,
        handledEvents: [],
      }

      registry.register(emptyModule)

      const handlers = registry.getHandlersForEvent(EventType.PLAYER_KILL)
      expect(handlers).toHaveLength(0)
      expect(registry.hasModule("EmptyModule")).toBe(true)

      const stats = registry.getStats()
      expect(stats.totalModules).toBe(1)
      expect(stats.eventCoverage).toEqual({})
    })

    it("should handle module with duplicate event types in handledEvents", () => {
      const duplicateEventsModule = {
        name: "DuplicateEventsModule",
        handler: mockHandler1,
        handledEvents: [EventType.PLAYER_KILL, EventType.PLAYER_KILL, EventType.PLAYER_CONNECT],
      }

      registry.register(duplicateEventsModule)

      const handlers = registry.getHandlersForEvent(EventType.PLAYER_KILL)
      expect(handlers).toHaveLength(1)
      expect(handlers[0]).toBe(duplicateEventsModule)
    })

    it("should preserve insertion order in getAllModules", () => {
      registry.register(module1)
      registry.register(module2)

      const allModules = registry.getAllModules()
      expect(allModules[0]).toBe(module1)
      expect(allModules[1]).toBe(module2)
    })

    it("should handle string errors in initialization", async () => {
      const errorModule = {
        name: "StringErrorModule",
        handler: mockHandler1,
        handledEvents: [EventType.PLAYER_KILL],
      }
      registry.register(errorModule)

      vi.mocked(mockLogger.debug).mockImplementationOnce(() => {
        throw "String error"
      })

      await expect(registry.initializeAll()).rejects.toThrow("String error")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to initialize module StringErrorModule",
        { error: "String error" },
      )
    })

    it("should handle string errors in destruction", async () => {
      registry.register(module1)

      vi.mocked(mockHandler1.destroy).mockImplementation(() => {
        throw "String destroy error"
      })

      await registry.destroyAll()

      expect(mockLogger.error).toHaveBeenCalledWith("Failed to destroy module PlayerModule", {
        error: "String destroy error",
      })
    })
  })
})
