/**
 * IngressService Unit Tests
 */

import { ServerStateManager } from "@/modules/server/state/server-state-manager"
import type { IEventPublisher } from "@/shared/infrastructure/messaging/queue/core/types"
import { TestClock } from "@/shared/infrastructure/time/test-clock"
import { createMockLogger } from "@/tests/mocks/logger"
import type { Socket } from "dgram"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TokenServerAuthenticator } from "./adapters/token-server-authenticator"
import type { IngressDependencies } from "./ingress.dependencies"
import { IngressService } from "./ingress.service"
import type { ISocketFactory } from "./udp-server"

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

// Create mock token authenticator
function createMockTokenAuthenticator(): TokenServerAuthenticator {
  return {
    handleBeacon: vi.fn().mockResolvedValue({ kind: "authenticated", serverId: 1 }),
    lookupSource: vi.fn().mockReturnValue(1),
    getAuthenticatedServerIds: vi.fn().mockReturnValue([1]),
    clearCaches: vi.fn(),
  } as unknown as TokenServerAuthenticator
}

describe("IngressService", () => {
  let ingressService: IngressService
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockEventPublisher: IEventPublisher
  let mockDependencies: IngressDependencies
  let mockTokenAuthenticator: TokenServerAuthenticator

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockTokenAuthenticator = createMockTokenAuthenticator()

    // Mock EventPublisher
    mockEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
    }

    // Mock dependencies
    mockDependencies = {
      tokenAuthenticator: mockTokenAuthenticator,
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
        1, // serverId
      )

      expect(event).toBeDefined()
      expect(mockDependencies.serverInfoProvider.getServerGame).toHaveBeenCalledWith(1)
    })

    it("should lookup source via token authenticator", () => {
      const serverId = ingressService.authenticateSource("127.0.0.1", 27015)
      expect(serverId).toBe(1)
      expect(mockTokenAuthenticator.lookupSource).toHaveBeenCalledWith("127.0.0.1", 27015)
    })

    it("should return undefined for unauthenticated sources", () => {
      vi.mocked(mockTokenAuthenticator.lookupSource).mockReturnValue(undefined)

      const serverId = ingressService.authenticateSource("127.0.0.1", 27015)

      expect(serverId).toBeUndefined()
    })

    it("should not emit events for unsupported games (noop parser)", async () => {
      // Change game for this server to an unsupported one
      vi.mocked(mockDependencies.serverInfoProvider.getServerGame).mockResolvedValueOnce(
        "unknown-game",
      )

      const event = await ingressService.processRawEvent(
        'L 03/15/2023 - 12:30:45: "Player<1><STEAM_1:1:12345><CT>" connected',
        1, // serverId
      )

      expect(event).toBeNull()
    })

    it("should get authenticated server IDs from token authenticator", () => {
      const serverIds = ingressService.getAuthenticatedServerIds()
      expect(serverIds).toEqual([1])
      expect(mockTokenAuthenticator.getAuthenticatedServerIds).toHaveBeenCalled()
    })
  })
})
