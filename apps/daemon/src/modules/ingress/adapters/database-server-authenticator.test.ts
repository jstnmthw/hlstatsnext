/**
 * Database Server Authenticator Unit Tests
 */

import type { DatabaseClient } from "@/database/client"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { DatabaseServerAuthenticator } from "./database-server-authenticator"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockDatabaseClient } from "@/tests/mocks/database"

describe("DatabaseServerAuthenticator", () => {
  let authenticator: DatabaseServerAuthenticator
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()

    // Set up specific mock functions
    mockDatabase.prisma.server.findFirst = vi.fn()
    mockDatabase.prisma.server.findMany = vi.fn()

    authenticator = new DatabaseServerAuthenticator(
      mockDatabase as unknown as DatabaseClient,
      mockLogger,
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
})
