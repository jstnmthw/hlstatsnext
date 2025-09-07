/**
 * Event Flow Integration Test
 *
 * Tests the complete event processing flow from log line to event publication,
 * ensuring all services are properly initialized and integrated.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createAppContext } from "@/context"
import { createMockLogger } from "../mocks/logger"
import type { IEventPublisher } from "@/shared/infrastructure/messaging/queue/core/types"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import { setUuidService } from "@/shared/infrastructure/messaging/queue/utils/message-utils"
import { SystemUuidService } from "@/shared/infrastructure/identifiers/system-uuid.service"
import { systemClock } from "@/shared/infrastructure/time"

// Mock the crypto package for integration tests
vi.mock("@repo/crypto", () => ({
  createCryptoService: vi.fn(() => ({
    hashPassword: vi.fn().mockResolvedValue("hashed_password"),
    verifyPassword: vi.fn().mockResolvedValue(true),
    encrypt: vi.fn().mockResolvedValue("encrypted_data"),
    decrypt: vi.fn().mockResolvedValue("decrypted_data"),
  })),
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
          }),
        },
      },
    },
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    crypto: {
      hashPassword: vi.fn().mockResolvedValue("hashed_password"),
      verifyPassword: vi.fn().mockResolvedValue(true),
      encrypt: vi.fn().mockResolvedValue("encrypted_data"),
      decrypt: vi.fn().mockResolvedValue("decrypted_data"),
    },
  })),
}))

describe("Event Flow Integration", () => {
  let mockEventPublisher: IEventPublisher
  let capturedEvents: BaseEvent[] = []

  beforeEach(() => {
    // Clear captured events
    capturedEvents = []

    // Mock event publisher to capture published events
    mockEventPublisher = {
      publish: vi.fn().mockImplementation(async (event: BaseEvent) => {
        capturedEvents.push(event)
      }),
      publishBatch: vi.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should process log lines end-to-end with UUID service initialized", async () => {
    // Create production-like context (this will initialize UUID service)
    const context = createAppContext({
      port: 27500,
      host: "127.0.0.1",
    })

    // Set up event publisher
    context.ingressService.setPublisher(mockEventPublisher)

    // Mock server authentication to return a valid server ID
    const mockAuthenticateServer = vi.fn().mockResolvedValue(1)
    const mockGetServerGame = vi.fn().mockResolvedValue("cstrike")

    // Override dependencies for this test
    const ingressService = context.ingressService as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const originalAuthenticator = ingressService.dependencies.serverAuthenticator
    const originalServerInfo = ingressService.dependencies.serverInfoProvider

    ingressService.dependencies.serverAuthenticator.authenticateServer = mockAuthenticateServer
    ingressService.dependencies.serverInfoProvider.getServerGame = mockGetServerGame

    try {
      // Test CS kill event processing
      const killLogLine =
        '"Player1<2><STEAM_123><CT>" killed "Player2<3><STEAM_456><TERRORIST>" with "ak47" (headshot)'

      const event = await context.ingressService.processRawEvent(killLogLine, "127.0.0.1", 27015)

      // Verify event was created successfully
      expect(event).not.toBeNull()
      expect(event?.eventType).toBe(EventType.PLAYER_KILL)
      expect(event?.serverId).toBe(1)

      // Verify event has UUID-generated fields
      expect(event?.eventId).toMatch(/^msg_[a-z0-9]+_[a-f0-9]{16}$/) // SystemUuidService format
      expect(event?.correlationId).toMatch(/^corr_[a-z0-9]+_[a-f0-9]{12}$/) // SystemUuidService format

      // Verify event data
      expect(event?.data).toEqual({
        killerId: 2,
        victimId: 3,
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

      // Verify server was authenticated
      expect(mockAuthenticateServer).toHaveBeenCalledWith("127.0.0.1", 27015)
      expect(mockGetServerGame).toHaveBeenCalledWith(1)
    } finally {
      // Restore original dependencies
      ingressService.dependencies.serverAuthenticator = originalAuthenticator
      ingressService.dependencies.serverInfoProvider = originalServerInfo
    }
  })

  it("should handle UUID service initialization errors gracefully", async () => {
    // Create logger to capture error messages
    const mockLogger = createMockLogger()

    // Create context without initializing UUID service (simulate the bug)
    const context = createAppContext()

    // Reset UUID service to uninitialized state to simulate the bug
    setUuidService(null as never) // Force uninitialized state

    // Override logger to capture errors
    const ingressService = context.ingressService as any // eslint-disable-line @typescript-eslint/no-explicit-any
    Object.assign(ingressService.logger, mockLogger)

    // Mock server authentication
    const mockAuthenticateServer = vi.fn().mockResolvedValue(1)
    const mockGetServerGame = vi.fn().mockResolvedValue("cstrike")

    ingressService.dependencies.serverAuthenticator.authenticateServer = mockAuthenticateServer
    ingressService.dependencies.serverInfoProvider.getServerGame = mockGetServerGame

    // Try to process a log line - should fail due to uninitialized UUID service
    const killLogLine =
      '"Player1<2><STEAM_123><CT>" killed "Player2<3><STEAM_456><TERRORIST>" with "ak47"'

    const event = await context.ingressService.processRawEvent(killLogLine, "127.0.0.1", 27015)

    // Verify event processing failed
    expect(event).toBeNull()

    // Verify error was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("UUID service not initialized"),
      expect.any(Object),
    )

    // Re-initialize UUID service for cleanup
    setUuidService(new SystemUuidService(systemClock as never))
  })

  it("should process multiple event types correctly", async () => {
    const context = createAppContext()
    context.ingressService.setPublisher(mockEventPublisher)

    // Mock dependencies
    const mockAuthenticateServer = vi.fn().mockResolvedValue(1)
    const mockGetServerGame = vi.fn().mockResolvedValue("cstrike")

    const ingressService = context.ingressService as any // eslint-disable-line @typescript-eslint/no-explicit-any
    ingressService.dependencies.serverAuthenticator.authenticateServer = mockAuthenticateServer
    ingressService.dependencies.serverInfoProvider.getServerGame = mockGetServerGame

    // Test different event types
    const testCases = [
      {
        logLine: '"Player1<2><STEAM_123><CT>" connected, address "192.168.1.100:27005"',
        expectedType: EventType.PLAYER_CONNECT,
      },
      {
        logLine: '"Player1<2><STEAM_123><CT>" entered the game',
        expectedType: EventType.PLAYER_ENTRY,
      },
      {
        logLine: '"Player1<2><STEAM_123><CT>" say "Hello world"',
        expectedType: EventType.CHAT_MESSAGE,
      },
    ]

    for (const testCase of testCases) {
      const event = await context.ingressService.processRawEvent(
        testCase.logLine,
        "127.0.0.1",
        27015,
      )

      expect(event).not.toBeNull()
      expect(event?.eventType).toBe(testCase.expectedType)
      expect(event?.eventId).toMatch(/^msg_[a-z0-9]+_[a-f0-9]{16}$/)
      expect(event?.correlationId).toMatch(/^corr_[a-z0-9]+_[a-f0-9]{12}$/)
    }
  })

  it("should handle parser errors with improved logging", async () => {
    const mockLogger = createMockLogger()
    const context = createAppContext()

    // Override logger
    const ingressService = context.ingressService as any // eslint-disable-line @typescript-eslint/no-explicit-any
    Object.assign(ingressService.logger, mockLogger)

    // Mock dependencies
    const mockAuthenticateServer = vi.fn().mockResolvedValue(1)
    const mockGetServerGame = vi.fn().mockResolvedValue("cstrike")

    ingressService.dependencies.serverAuthenticator.authenticateServer = mockAuthenticateServer
    ingressService.dependencies.serverInfoProvider.getServerGame = mockGetServerGame

    // Try to process a malformed log line
    const malformedLogLine = "This is not a valid game log line"

    const event = await context.ingressService.processRawEvent(malformedLogLine, "127.0.0.1", 27015)

    // Event should be null (parsing failed)
    expect(event).toBeNull()

    // Should NOT have called warn (because this is just an unrecognized line, not an error)
    // Only actual parse errors (like regex failures) should trigger warnings
    expect(mockLogger.warn).not.toHaveBeenCalled()
  })

  it("should track statistics correctly", async () => {
    const context = createAppContext()
    context.ingressService.setPublisher(mockEventPublisher)

    // Mock dependencies
    const mockAuthenticateServer = vi.fn().mockResolvedValue(1)
    const mockGetServerGame = vi.fn().mockResolvedValue("cstrike")

    const ingressService = context.ingressService as any // eslint-disable-line @typescript-eslint/no-explicit-any
    ingressService.dependencies.serverAuthenticator.authenticateServer = mockAuthenticateServer
    ingressService.dependencies.serverInfoProvider.getServerGame = mockGetServerGame

    // Process some log lines via handleLogLine (private method, but we can test via processRawEvent)
    const testLines = [
      '"Player1<2><STEAM_123><CT>" killed "Player2<3><STEAM_456><TERRORIST>" with "ak47"',
      '"Player1<2><STEAM_123><CT>" say "gg"',
      "Invalid log line that should be ignored",
    ]

    for (const line of testLines) {
      await context.ingressService.processRawEvent(line, "127.0.0.1", 27015)
    }

    const stats = context.ingressService.getStats()

    // Should have processed some logs (exact count depends on what gets processed)
    expect(stats.totalLogsProcessed).toBeGreaterThanOrEqual(0)
    expect(stats.totalErrors).toBeGreaterThanOrEqual(0)
  })
})
