/**
 * IngressService Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { IngressService } from "./ingress.service"
import { createMockLogger } from "@/tests/mocks/logger"
import type { IEventPublisher } from "@/shared/infrastructure/messaging/queue/core/types"
import type { IngressDependencies } from "./ingress.dependencies"
import type { ISocketFactory } from "./udp-server"
import { TestClock } from "@/shared/infrastructure/time/test-clock"
import { ServerStateManager } from "@/modules/server/state/server-state-manager"
import type { Socket } from "dgram"

// Mock socket for UDP server
const createMockSocket = () => ({
  bind: vi.fn((_port?: number, _host?: string, callback?: () => void) => {
    if (callback) callback()
  }),
  close: vi.fn((callback?: () => void) => {
    if (callback) callback()
  }),
  on: vi.fn((() => {
    return mockSocket
  }) as unknown as Socket["on"]),

  removeAllListeners: vi.fn(),
  address: vi.fn(() => ({ address: "0.0.0.0", family: "IPv4", port: 27501 })),
  listening: false,
})

const mockSocket = createMockSocket()

// Create mock socket factory
const mockSocketFactory: ISocketFactory = {
  createSocket: vi.fn(() => mockSocket as unknown as Socket),
}

describe("IngressService", () => {
  let ingressService: IngressService
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockEventPublisher: IEventPublisher
  let mockDependencies: IngressDependencies

  beforeEach(() => {
    mockLogger = createMockLogger()

    // Mock EventPublisher
    mockEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
    }

    // Mock dependencies
    mockDependencies = {
      serverAuthenticator: {
        authenticateServer: vi.fn().mockResolvedValue(1),
        cacheServer: vi.fn().mockResolvedValue(undefined),
        getAuthenticatedServerIds: vi.fn().mockReturnValue([]),
      },
      gameDetector: {
        detectGame: vi.fn().mockResolvedValue({
          gameCode: "csgo",
          confidence: 0.8,
          detection_method: "mock",
        }),
      },
      serverInfoProvider: {
        getServerGame: vi.fn().mockResolvedValue("cstrike"),
        findOrCreateServer: vi.fn().mockResolvedValue({
          serverId: 1,
          address: "127.0.0.1",
          port: 27015,
          game: "cstrike",
          name: "Test Server",
        }),
      },
      serverStateManager: new ServerStateManager(createMockLogger()),
      clock: new TestClock(),
    }

    ingressService = new IngressService(
      mockLogger,
      mockDependencies,
      {
        port: 27501,
        logBots: false,
      },
      mockSocketFactory,
    )
    ingressService.setPublisher(mockEventPublisher)
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
    it("should process raw events using server's game parser", async () => {
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
      expect(mockDependencies.serverInfoProvider.getServerGame).toHaveBeenCalledWith(1)
    })

    it("should handle server authentication", async () => {
      const serverId = await ingressService.authenticateServer("127.0.0.1", 27015)
      expect(serverId).toBe(1)
      expect(mockDependencies.serverAuthenticator.authenticateServer).toHaveBeenCalledWith(
        "127.0.0.1",
        27015,
      )
    })

    it("should return null for unauthenticated servers", async () => {
      const authenticateServerMock = mockDependencies.serverAuthenticator
        .authenticateServer as ReturnType<typeof vi.fn>
      authenticateServerMock.mockResolvedValue(null)

      const serverId = await ingressService.authenticateServer("127.0.0.1", 27015)

      expect(serverId).toBeNull()
      expect(mockDependencies.gameDetector.detectGame).not.toHaveBeenCalled()
      expect(mockDependencies.serverInfoProvider.findOrCreateServer).not.toHaveBeenCalled()
    })

    it("should not emit events for unsupported games (noop parser)", async () => {
      // Change game for this server to an unsupported one
      ;(
        mockDependencies.serverInfoProvider.getServerGame as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce("unknown-game")

      const event = await ingressService.processRawEvent(
        'L 03/15/2023 - 12:30:45: "Player<1><STEAM_1:1:12345><CT>" connected',
        "127.0.0.1",
        27015,
      )

      expect(event).toBeNull()
    })
  })
})
