/**
 * Event Flow Integration Test
 *
 * Tests the complete event processing flow from log line to event publication,
 * ensuring all services are properly initialized and integrated.
 */

import { createAppContext } from "@/context"
import { SystemUuidService } from "@/shared/infrastructure/identifiers/system-uuid.service"
import type { IEventPublisher } from "@/shared/infrastructure/messaging/queue/core/types"
import { setUuidService } from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import { systemClock } from "@/shared/infrastructure/time"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TokenServerAuthenticator } from "./adapters/token-server-authenticator"

// Type for testing ingress service internal access
interface TestIngressService {
  dependencies: {
    tokenAuthenticator: TokenServerAuthenticator
    serverInfoProvider: {
      getServerGame: ReturnType<typeof vi.fn>
    }
  }
  logger?: Record<string, ReturnType<typeof vi.fn>>
  setPublisher: (publisher: IEventPublisher) => void
  processRawEvent: (logLine: string, serverId: number) => Promise<BaseEvent | null>
  getStats: () => { totalLogsProcessed: number; totalErrors: number }
}

// Mock the crypto package for integration tests
vi.mock("@repo/crypto", () => ({
  createCryptoService: vi.fn(() => ({
    hashPassword: vi.fn().mockResolvedValue("hashed_password"),
    verifyPassword: vi.fn().mockResolvedValue(true),
    encrypt: vi.fn().mockResolvedValue("encrypted_data"),
    decrypt: vi.fn().mockResolvedValue("decrypted_data"),
  })),
  generateToken: vi.fn(() => ({
    raw: "hlxn_testtoken12345678901234567890123456789012",
    hash: "abc123hash",
    prefix: "hlxn_testto",
  })),
  hashToken: vi.fn(() => "abc123hash"),
  isValidTokenFormat: vi.fn(() => true),
}))

// Mock the infrastructure config factory
vi.mock("@/shared/application/factories/infrastructure-config.factory", () => ({
  createInfrastructureComponents: vi.fn(() => ({
    database: {
      prisma: {
        server: {
          findUnique: vi.fn().mockResolvedValue({
            serverId: 1,
            game: "cstrike",
            name: "Test Server",
            address: "127.0.0.1",
            port: 27015,
          }),
          findFirst: vi.fn().mockResolvedValue({
            serverId: 1,
            game: "cstrike",
            authTokenId: 1,
          }),
          create: vi.fn().mockResolvedValue({ serverId: 1 }),
          update: vi.fn().mockResolvedValue({ serverId: 1 }),
        },
        serverToken: {
          findUnique: vi.fn().mockResolvedValue({
            id: 1,
            tokenHash: "abc123hash",
            tokenPrefix: "hlxn_testto",
            name: "Test Token",
            rconPassword: "",
            game: "cstrike",
            createdAt: new Date(),
            expiresAt: null,
            revokedAt: null,
            lastUsedAt: null,
            createdBy: "test",
          }),
          update: vi.fn(),
        },
      },
      testConnection: vi.fn().mockResolvedValue(true),
    },
    eventBus: {
      emit: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      clear: vi.fn(),
    },
    eventQueue: {
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      getMetrics: vi.fn().mockReturnValue({ queueSize: 0 }),
      createPublisher: vi.fn(() => ({
        publish: vi.fn().mockResolvedValue(undefined),
        publishBatch: vi.fn().mockResolvedValue(undefined),
      })),
    },
    metricsServer: {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    },
  })),
}))

describe("Event Flow Integration", () => {
  let mockEventPublisher: IEventPublisher
  let capturedEvents: BaseEvent[]

  beforeEach(() => {
    vi.clearAllMocks()

    // Initialize UUID service for event ID generation
    const uuidService = new SystemUuidService(systemClock)
    setUuidService(uuidService)

    // Create event publisher that captures published events
    capturedEvents = []
    mockEventPublisher = {
      publish: vi.fn(async (event: BaseEvent) => {
        capturedEvents.push(event)
      }),
      publishBatch: vi.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should process kill events from CS log lines with proper UUIDs", async () => {
    const context = createAppContext({
      host: "127.0.0.1",
    })

    // Set up event publisher
    context.ingressService.setPublisher(mockEventPublisher)

    // Mock server info provider to return game code
    const mockGetServerGame = vi.fn().mockResolvedValue("cstrike")

    // Override dependencies for this test
    const ingressService = context.ingressService as unknown as TestIngressService
    ingressService.dependencies.serverInfoProvider.getServerGame = mockGetServerGame

    // Test CS kill event processing - pass serverId directly (server is already authenticated)
    const killLogLine =
      '"Player1<2><STEAM_123><CT>" killed "Player2<3><STEAM_456><TERRORIST>" with "ak47" (headshot)'

    const event = await ingressService.processRawEvent(killLogLine, 1)

    // Verify event was created successfully
    expect(event).not.toBeNull()
    expect(event?.eventType).toBe(EventType.PLAYER_KILL)
    expect(event?.serverId).toBe(1)

    // Verify event has UUID-generated fields
    expect(event?.eventId).toMatch(/^msg_[a-z0-9]+_[a-f0-9]{16}$/) // SystemUuidService format
    expect(event?.correlationId).toMatch(/^corr_[a-z0-9]+_[a-f0-9]{12}$/) // SystemUuidService format

    // Verify event data (parser outputs gameUserId before resolution)
    expect(event?.data).toEqual({
      killerGameUserId: 2,
      victimGameUserId: 3,
      weapon: "ak47",
      headshot: true,
      killerTeam: "CT",
      victimTeam: "TERRORIST",
    })

    // Verify metadata
    expect(event?.meta).toEqual({
      killer: {
        steamId: "STEAM_123",
        playerName: "Player1",
        isBot: false,
      },
      victim: {
        steamId: "STEAM_456",
        playerName: "Player2",
        isBot: false,
      },
    })

    // Verify game was looked up
    expect(mockGetServerGame).toHaveBeenCalledWith(1)
  })

  it("should handle UUID service initialization errors gracefully", async () => {
    // Create logger to capture error messages
    const mockLogger = createMockLogger()

    // Create context without initializing UUID service (simulate the bug)
    const context = createAppContext()

    // Reset UUID service to uninitialized state to simulate the bug
    setUuidService(null as never) // Force uninitialized state

    // Override logger to capture errors
    const ingressService = context.ingressService as unknown as TestIngressService
    if (ingressService.logger) {
      Object.assign(ingressService.logger, mockLogger)
    }

    // Mock server info provider
    const mockGetServerGame = vi.fn().mockResolvedValue("cstrike")
    ingressService.dependencies.serverInfoProvider.getServerGame = mockGetServerGame

    // Try to process a log line - should fail due to uninitialized UUID service
    const killLogLine =
      '"Player1<2><STEAM_123><CT>" killed "Player2<3><STEAM_456><TERRORIST>" with "ak47"'

    const event = await ingressService.processRawEvent(killLogLine, 1)

    // Verify event processing failed
    expect(event).toBeNull()

    // Verify stats show error
    const stats = ingressService.getStats()
    expect(stats.totalErrors).toBeGreaterThan(0)
  })

  it("should process connect events correctly", async () => {
    const context = createAppContext({
      host: "127.0.0.1",
    })

    context.ingressService.setPublisher(mockEventPublisher)

    const ingressService = context.ingressService as unknown as TestIngressService
    const mockGetServerGame = vi.fn().mockResolvedValue("cstrike")
    ingressService.dependencies.serverInfoProvider.getServerGame = mockGetServerGame

    // Test connect event
    const connectLogLine = '"Player1<2><STEAM_123><>" connected, address "192.168.1.100:27005"'

    const event = await ingressService.processRawEvent(connectLogLine, 1)

    expect(event).not.toBeNull()
    expect(event?.eventType).toBe(EventType.PLAYER_CONNECT)
    expect(event?.serverId).toBe(1)
  })

  it("should process disconnect events correctly", async () => {
    const context = createAppContext({
      host: "127.0.0.1",
    })

    context.ingressService.setPublisher(mockEventPublisher)

    const ingressService = context.ingressService as unknown as TestIngressService
    const mockGetServerGame = vi.fn().mockResolvedValue("cstrike")
    ingressService.dependencies.serverInfoProvider.getServerGame = mockGetServerGame

    // Test disconnect event
    const disconnectLogLine = '"Player1<2><STEAM_123><CT>" disconnected'

    const event = await ingressService.processRawEvent(disconnectLogLine, 1)

    expect(event).not.toBeNull()
    expect(event?.eventType).toBe(EventType.PLAYER_DISCONNECT)
  })

  it("should process suicide events correctly", async () => {
    const context = createAppContext({
      host: "127.0.0.1",
    })

    context.ingressService.setPublisher(mockEventPublisher)

    const ingressService = context.ingressService as unknown as TestIngressService
    const mockGetServerGame = vi.fn().mockResolvedValue("cstrike")
    ingressService.dependencies.serverInfoProvider.getServerGame = mockGetServerGame

    // Test suicide event
    const suicideLogLine = '"Player1<2><STEAM_123><CT>" committed suicide with "worldspawn"'

    const event = await ingressService.processRawEvent(suicideLogLine, 1)

    expect(event).not.toBeNull()
    expect(event?.eventType).toBe(EventType.PLAYER_SUICIDE)
  })

  it("should return null for unsupported log lines", async () => {
    const context = createAppContext({
      host: "127.0.0.1",
    })

    context.ingressService.setPublisher(mockEventPublisher)

    const ingressService = context.ingressService as unknown as TestIngressService
    const mockGetServerGame = vi.fn().mockResolvedValue("cstrike")
    ingressService.dependencies.serverInfoProvider.getServerGame = mockGetServerGame

    // Test an unsupported log line
    const unknownLogLine = "some random text that is not a valid log line"

    const event = await ingressService.processRawEvent(unknownLogLine, 1)

    // Should return null for unparseable lines
    expect(event).toBeNull()
  })
})
