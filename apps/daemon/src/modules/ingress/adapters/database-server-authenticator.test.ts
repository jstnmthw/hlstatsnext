/**
 * Database Server Authenticator Unit Tests
 */

import type { DatabaseClient } from "@/database/client"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { DatabaseServerAuthenticator } from "./database-server-authenticator"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockDatabaseClient } from "@/tests/mocks/database"
import type { IEventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus.types"
import { EventType } from "@/shared/types/events"

describe("DatabaseServerAuthenticator", () => {
  let authenticator: DatabaseServerAuthenticator
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>
  let mockEventBus: IEventBus

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    mockEventBus = {
      emit: vi.fn().mockResolvedValue(undefined),
      on: vi.fn().mockReturnValue("mock-handler-id"),
      off: vi.fn(),
      clearHandlers: vi.fn(),
      getStats: vi.fn().mockReturnValue({
        totalHandlers: 0,
        handlersByType: new Map(),
        eventsEmitted: 0,
        errors: 0,
      }),
    }

    // Set up specific mock functions
    mockDatabase.prisma.server.findFirst = vi.fn()
    mockDatabase.prisma.server.findMany = vi.fn()

    authenticator = new DatabaseServerAuthenticator(
      mockDatabase as unknown as DatabaseClient,
      mockLogger,
      mockEventBus,
    )
  })

  describe("External Server Authentication", () => {
    it("should authenticate external server with exact IP:port match", async () => {
      const mockServer = { serverId: 1 }
      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce(mockServer as never)

      const result = await authenticator.authenticateServer("192.168.1.100", 27015)

      expect(result).toBe(1)
      expect(mockDatabase.prisma.server.findFirst).toHaveBeenCalledWith({
        where: { address: "192.168.1.100", port: 27015 },
        select: { serverId: true },
      })
    })

    it("should cache authenticated servers", async () => {
      const mockServer = { serverId: 1 }
      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce(mockServer as never)

      // First call - hits database
      await authenticator.authenticateServer("192.168.1.100", 27015)
      expect(mockDatabase.prisma.server.findFirst).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      const result = await authenticator.authenticateServer("192.168.1.100", 27015)
      expect(result).toBe(1)
      expect(mockDatabase.prisma.server.findFirst).toHaveBeenCalledTimes(1)
    })

    it("should return null for unknown external server", async () => {
      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce(null)

      const result = await authenticator.authenticateServer("192.168.1.100", 27015)

      expect(result).toBeNull()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Unknown server attempted connection"),
      )
    })
  })

  describe("Docker Server Authentication", () => {
    it("should authenticate Docker server from Docker network IP", async () => {
      const mockDockerServers = [
        {
          serverId: 2,
          dockerHost: "hlstatsnext-cstrike",
          name: "CS 1.6 Docker",
          game: "cstrike",
        },
      ]

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce(null)
      vi.mocked(mockDatabase.prisma.server.findMany).mockResolvedValueOnce(
        mockDockerServers as never,
      )

      const result = await authenticator.authenticateServer("172.17.0.2", 45678)

      expect(result).toBe(2)
      expect(mockDatabase.prisma.server.findMany).toHaveBeenCalledWith({
        where: { connectionType: "docker" },
        select: {
          serverId: true,
          dockerHost: true,
          name: true,
          game: true,
        },
      })
    })

    it("should detect Docker network IPs correctly", async () => {
      const dockerIPs = ["172.17.0.2", "172.18.0.5", "172.31.255.255", "10.0.0.1", "10.255.255.255"]

      const nonDockerIPs = [
        "192.168.1.1",
        "172.15.0.1", // Outside Docker range
        "172.32.0.1", // Outside Docker range
        "127.0.0.1",
        "8.8.8.8",
      ]

      for (const ip of dockerIPs) {
        vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce(null)
        vi.mocked(mockDatabase.prisma.server.findMany).mockResolvedValueOnce([])

        await authenticator.authenticateServer(ip, 12345)

        expect(mockDatabase.prisma.server.findMany).toHaveBeenCalled()
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining("Docker network detected"),
        )
      }

      // Reset mocks
      vi.clearAllMocks()
      // Recreate authenticator to clear cache
      authenticator = new DatabaseServerAuthenticator(
        mockDatabase as unknown as DatabaseClient,
        mockLogger,
        mockEventBus,
      )

      for (const ip of nonDockerIPs) {
        vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce(null)

        await authenticator.authenticateServer(ip, 12345)

        expect(mockDatabase.prisma.server.findMany).not.toHaveBeenCalled()
      }
    })
  })

  describe("Error Handling", () => {
    it("should handle invalid IP addresses", async () => {
      const result = await authenticator.authenticateServer("not.an.ip", 27015)

      expect(result).toBeNull()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid server credentials"),
      )
    })

    it("should handle invalid ports", async () => {
      const result = await authenticator.authenticateServer("192.168.1.1", -1)

      expect(result).toBeNull()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid server credentials"),
      )
    })

    it("should handle database errors gracefully", async () => {
      vi.mocked(mockDatabase.prisma.server.findFirst).mockRejectedValueOnce(
        new Error("Database connection failed"),
      )

      const result = await authenticator.authenticateServer("192.168.1.1", 27015)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Database error during server authentication"),
      )
    })
  })

  describe("Cache Management", () => {
    it("should cache servers correctly", async () => {
      await authenticator.cacheServer("192.168.1.100", 27015, 123)

      const result = await authenticator.authenticateServer("192.168.1.100", 27015)

      expect(result).toBe(123)
      expect(mockDatabase.prisma.server.findFirst).not.toHaveBeenCalled()
    })

    it("should clear cache on clearCache()", async () => {
      await authenticator.cacheServer("192.168.1.100", 27015, 123)

      authenticator.clearCache()

      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce({
        serverId: 456,
      } as never)

      const result = await authenticator.authenticateServer("192.168.1.100", 27015)

      expect(result).toBe(456)
      expect(mockDatabase.prisma.server.findFirst).toHaveBeenCalled()
    })
  })

  describe("Event Emission", () => {
    it("should emit SERVER_AUTHENTICATED event for new server authentication", async () => {
      // Mock a successful authentication for a new server
      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce({
        serverId: 42,
        name: "Test Server",
        address: "192.168.1.100",
        port: 27015,
        game: "cstrike",
        connectionType: "external",
      } as never)

      // Authenticate the server
      const result = await authenticator.authenticateServer("192.168.1.100", 27015)

      // Verify authentication succeeded
      expect(result).toBe(42)

      // Verify that the SERVER_AUTHENTICATED event was emitted
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.SERVER_AUTHENTICATED,
          serverId: 42,
          timestamp: expect.any(Date),
        }),
      )
    })

    it("should not emit event for already authenticated server", async () => {
      // Cache a server first
      await authenticator.cacheServer("192.168.1.100", 27015, 42)

      // Clear the emit mock calls from previous operations
      vi.mocked(mockEventBus.emit).mockClear()

      // Authenticate the same server again (should use cache)
      const result = await authenticator.authenticateServer("192.168.1.100", 27015)

      // Verify authentication succeeded
      expect(result).toBe(42)

      // Verify that NO event was emitted (since it's not a new authentication)
      expect(mockEventBus.emit).not.toHaveBeenCalled()
    })

    it("should handle event emission errors gracefully", async () => {
      // Mock event emission to throw an error
      vi.mocked(mockEventBus.emit).mockRejectedValueOnce(new Error("EventBus error"))

      // Mock a successful authentication
      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce({
        serverId: 42,
        name: "Test Server",
        address: "192.168.1.100",
        port: 27015,
        game: "cstrike",
        connectionType: "external",
      } as never)

      // Authentication should still succeed despite event emission error
      const result = await authenticator.authenticateServer("192.168.1.100", 27015)

      expect(result).toBe(42)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Error emitting server authentication event"),
      )
    })
  })
})
