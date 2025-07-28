/**
 * IngressService Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { IngressService } from "./ingress.service"
import { createMockLogger } from "../../tests/mocks/logger"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { IngressDependencies } from "./ingress.dependencies"

describe("IngressService", () => {
  let ingressService: IngressService
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockEventBus: IEventBus
  let mockDependencies: IngressDependencies

  beforeEach(() => {
    mockLogger = createMockLogger()

    // Mock EventBus
    mockEventBus = {
      emit: vi.fn().mockResolvedValue(undefined),
      on: vi.fn().mockReturnValue("handler-id"),
      off: vi.fn(),
      clearHandlers: vi.fn(),
      getStats: vi.fn().mockReturnValue({
        totalHandlers: 0,
        handlersByType: new Map(),
        eventsEmitted: 0,
        errors: 0,
      }),
    }

    // Mock dependencies
    mockDependencies = {
      serverAuthenticator: {
        authenticateServer: vi.fn().mockResolvedValue(1),
        cacheServer: vi.fn().mockResolvedValue(undefined),
      },
      gameDetector: {
        detectGame: vi.fn().mockResolvedValue({
          gameCode: "csgo",
          confidence: 0.8,
          detection_method: "mock",
        }),
      },
      serverInfoProvider: {
        getServerGame: vi.fn().mockResolvedValue("csgo"),
        findOrCreateServer: vi.fn().mockResolvedValue({
          serverId: 1,
          address: "127.0.0.1",
          port: 27015,
          game: "csgo",
          name: "Test Server",
        }),
      },
    }

    ingressService = new IngressService(mockLogger, mockEventBus, mockDependencies, {
      port: 27501,
      skipAuth: true,
      logBots: false,
    })
  })

  afterEach(() => {
    if (ingressService.isRunning()) {
      ingressService.stop()
    }
  })

  describe("Service lifecycle", () => {
    it("should initialize with correct configuration", () => {
      expect(ingressService).toBeDefined()
      expect(ingressService.isRunning()).toBe(false)
    })

    it("should start successfully", async () => {
      await ingressService.start()
      expect(ingressService.isRunning()).toBe(true)
      expect(mockLogger.starting).toHaveBeenCalledWith("Ingress Server")
      expect(mockLogger.started).toHaveBeenCalledWith("Ingress Server on 0.0.0.0:27501")
    })

    it("should stop successfully", async () => {
      await ingressService.start()
      ingressService.stop()
      expect(ingressService.isRunning()).toBe(false)
      expect(mockLogger.stopping).toHaveBeenCalledWith("Ingress Server")
    })

    it("should throw error when starting twice", async () => {
      await ingressService.start()
      await expect(ingressService.start()).rejects.toThrow("IngressService is already running")
    })

    it("should return stats", () => {
      const stats = ingressService.getStats()
      expect(stats).toHaveProperty("totalLogsProcessed")
      expect(stats).toHaveProperty("totalErrors")
      expect(stats).toHaveProperty("startTime")
      expect(stats).toHaveProperty("uptime")
    })
  })

  describe("Event processing", () => {
    it("should process raw events and emit through event bus", async () => {
      const event = await ingressService.processRawEvent(
        'L 03/15/2023 - 12:30:45: "Player<1><STEAM_1:1:12345><CT>" connected',
        "127.0.0.1",
        27015,
      )

      expect(event).toBeDefined()
      expect(mockDependencies.serverAuthenticator.authenticateServer).toHaveBeenCalledWith(
        "127.0.0.1",
        27015,
      )
    })

    it("should handle server authentication", async () => {
      const serverId = await ingressService.authenticateServer("127.0.0.1", 27015)
      expect(serverId).toBe(1)
      expect(mockDependencies.serverAuthenticator.authenticateServer).toHaveBeenCalledWith(
        "127.0.0.1",
        27015,
      )
    })

    it("should handle development mode server creation", async () => {
      const authenticateServerMock = mockDependencies.serverAuthenticator
        .authenticateServer as ReturnType<typeof vi.fn>
      authenticateServerMock.mockResolvedValue(-1)

      const serverId = await ingressService.authenticateServer("127.0.0.1", 27015)

      expect(serverId).toBe(1)
      expect(mockDependencies.gameDetector.detectGame).toHaveBeenCalled()
      expect(mockDependencies.serverInfoProvider.findOrCreateServer).toHaveBeenCalled()
    })
  })
})
