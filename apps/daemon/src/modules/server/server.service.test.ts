/**
 * ServerService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { ServerService } from "./server.service"
import { createMockLogger } from "../../tests/mocks/logger"
import type { IServerRepository, ServerInfo } from "./server.types"

const createMockServerRepository = () => ({
  findById: vi.fn(),
  findByAddress: vi.fn(),
  getServerConfig: vi.fn(),
  hasRconCredentials: vi.fn().mockResolvedValue(false),
  findActiveServersWithRcon: vi.fn().mockResolvedValue([]),
})

describe("ServerService", () => {
  let serverService: ServerService
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockRepository: ReturnType<typeof createMockServerRepository>

  const mockServerInfo: ServerInfo = {
    serverId: 1,
    game: "cstrike",
    name: "Test CS Server",
    address: "192.168.1.100",
    port: 27015,
  }

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockServerRepository()
    serverService = new ServerService(mockRepository as IServerRepository, mockLogger)
  })

  describe("Service instantiation", () => {
    it("should create service instance", () => {
      expect(serverService).toBeDefined()
      expect(serverService).toBeInstanceOf(ServerService)
    })

    it("should have required methods", () => {
      expect(serverService.getServer).toBeDefined()
      expect(serverService.getServerByAddress).toBeDefined()
      expect(serverService.getServerGame).toBeDefined()
      expect(typeof serverService.getServer).toBe("function")
      expect(typeof serverService.getServerByAddress).toBe("function")
      expect(typeof serverService.getServerGame).toBe("function")
    })
  })

  describe("getServer", () => {
    it("should return server info when server exists", async () => {
      const serverId = 1
      mockRepository.findById.mockResolvedValue(mockServerInfo)

      const result = await serverService.getServer(serverId)

      expect(result).toEqual(mockServerInfo)
      expect(mockRepository.findById).toHaveBeenCalledWith(serverId)
    })

    it("should return null when server does not exist", async () => {
      const serverId = 999
      mockRepository.findById.mockResolvedValue(null)

      const result = await serverService.getServer(serverId)

      expect(result).toBeNull()
      expect(mockRepository.findById).toHaveBeenCalledWith(serverId)
    })

    it("should handle repository errors", async () => {
      const serverId = 1
      mockRepository.findById.mockRejectedValue(new Error("Database error"))

      await expect(serverService.getServer(serverId)).rejects.toThrow("Database error")
      expect(mockRepository.findById).toHaveBeenCalledWith(serverId)
    })
  })

  describe("getServerByAddress", () => {
    it("should return server info when server exists", async () => {
      const address = "192.168.1.100"
      const port = 27015
      mockRepository.findByAddress.mockResolvedValue(mockServerInfo)

      const result = await serverService.getServerByAddress(address, port)

      expect(result).toEqual(mockServerInfo)
      expect(mockRepository.findByAddress).toHaveBeenCalledWith(address, port)
    })

    it("should return null when server does not exist", async () => {
      const address = "192.168.1.200"
      const port = 27016
      mockRepository.findByAddress.mockResolvedValue(null)

      const result = await serverService.getServerByAddress(address, port)

      expect(result).toBeNull()
      expect(mockRepository.findByAddress).toHaveBeenCalledWith(address, port)
    })

    it("should handle repository errors", async () => {
      const address = "192.168.1.100"
      const port = 27015
      mockRepository.findByAddress.mockRejectedValue(new Error("Database error"))

      await expect(serverService.getServerByAddress(address, port)).rejects.toThrow(
        "Database error",
      )
      expect(mockRepository.findByAddress).toHaveBeenCalledWith(address, port)
    })

    it("should handle edge cases with address and port", async () => {
      // Test with different address formats
      const testCases = [
        { address: "127.0.0.1", port: 27015 },
        { address: "localhost", port: 27015 },
        { address: "example.com", port: 27015 },
        { address: "192.168.1.100", port: 0 },
        { address: "192.168.1.100", port: 65535 },
      ]

      for (const { address, port } of testCases) {
        mockRepository.findByAddress.mockResolvedValue(mockServerInfo)
        await serverService.getServerByAddress(address, port)
        expect(mockRepository.findByAddress).toHaveBeenCalledWith(address, port)
      }
    })
  })

  describe("getServerGame", () => {
    it("should return game type when server exists", async () => {
      const serverId = 1
      mockRepository.findById.mockResolvedValue(mockServerInfo)

      const result = await serverService.getServerGame(serverId)

      expect(result).toBe("cstrike")
      expect(mockRepository.findById).toHaveBeenCalledWith(serverId)
    })

    it("should return 'unknown' when server does not exist", async () => {
      const serverId = 999
      mockRepository.findById.mockResolvedValue(null)

      const result = await serverService.getServerGame(serverId)

      expect(result).toBe("unknown")
      expect(mockRepository.findById).toHaveBeenCalledWith(serverId)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Server ${serverId} not found, defaulting to unknown game type`,
      )
    })

    it("should handle repository errors", async () => {
      const serverId = 1
      mockRepository.findById.mockRejectedValue(new Error("Database error"))

      await expect(serverService.getServerGame(serverId)).rejects.toThrow("Database error")
      expect(mockRepository.findById).toHaveBeenCalledWith(serverId)
    })

    it("should handle different game types", async () => {
      const gameTypes = ["cstrike", "css", "csgo", "tf2", "dod"]

      for (const game of gameTypes) {
        const serverInfo = { ...mockServerInfo, game }
        mockRepository.findById.mockResolvedValue(serverInfo)

        const result = await serverService.getServerGame(1)
        expect(result).toBe(game)
      }
    })
  })

  describe("Error handling", () => {
    it("should handle undefined server ID", async () => {
      mockRepository.findById.mockResolvedValue(null)

      const result = await serverService.getServer(undefined as unknown as number)

      expect(result).toBeNull()
      expect(mockRepository.findById).toHaveBeenCalledWith(undefined)
    })

    it("should handle negative server ID", async () => {
      const serverId = -1
      mockRepository.findById.mockResolvedValue(null)

      const result = await serverService.getServer(serverId)

      expect(result).toBeNull()
      expect(mockRepository.findById).toHaveBeenCalledWith(serverId)
    })

    it("should handle empty address", async () => {
      const address = ""
      const port = 27015
      mockRepository.findByAddress.mockResolvedValue(null)

      const result = await serverService.getServerByAddress(address, port)

      expect(result).toBeNull()
      expect(mockRepository.findByAddress).toHaveBeenCalledWith(address, port)
    })

    it("should handle zero port", async () => {
      const address = "192.168.1.100"
      const port = 0
      mockRepository.findByAddress.mockResolvedValue(null)

      const result = await serverService.getServerByAddress(address, port)

      expect(result).toBeNull()
      expect(mockRepository.findByAddress).toHaveBeenCalledWith(address, port)
    })
  })

  describe("Integration scenarios", () => {
    it("should handle multiple concurrent getServer calls", async () => {
      const serverIds = [1, 2, 3, 4, 5]
      const promises = serverIds.map((id) => {
        const serverInfo = { ...mockServerInfo, serverId: id }
        mockRepository.findById.mockResolvedValueOnce(serverInfo)
        return serverService.getServer(id)
      })

      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      results.forEach((result, index) => {
        expect(result?.serverId).toBe(serverIds[index])
      })
    })

    it("should handle mixed success and failure scenarios", async () => {
      const testCases = [
        { serverId: 1, shouldSucceed: true },
        { serverId: 2, shouldSucceed: false },
        { serverId: 3, shouldSucceed: true },
      ]

      const promises = testCases.map(({ serverId, shouldSucceed }) => {
        if (shouldSucceed) {
          const serverInfo = { ...mockServerInfo, serverId }
          mockRepository.findById.mockResolvedValueOnce(serverInfo)
        } else {
          mockRepository.findById.mockResolvedValueOnce(null)
        }
        return serverService.getServer(serverId)
      })

      const results = await Promise.all(promises)

      expect(results[0]).toEqual({ ...mockServerInfo, serverId: 1 })
      expect(results[1]).toBeNull()
      expect(results[2]).toEqual({ ...mockServerInfo, serverId: 3 })
    })
  })

  describe("findActiveServersWithRcon", () => {
    it("should return active servers with RCON", async () => {
      const mockActiveServers = [
        {
          serverId: 1,
          game: "cstrike",
          name: "Test CS Server 1",
          address: "192.168.1.100",
          port: 27015,
          lastEvent: new Date(),
        },
        {
          serverId: 2,
          game: "csgo",
          name: "Test CS:GO Server",
          address: "192.168.1.101",
          port: 27015,
          lastEvent: new Date(),
        },
      ]

      mockRepository.findActiveServersWithRcon.mockResolvedValue(mockActiveServers)

      const result = await serverService.findActiveServersWithRcon()

      expect(result).toEqual(mockActiveServers)
      expect(mockRepository.findActiveServersWithRcon).toHaveBeenCalledWith(undefined)
    })

    it("should pass maxAgeMinutes parameter to repository", async () => {
      const maxAgeMinutes = 30
      mockRepository.findActiveServersWithRcon.mockResolvedValue([])

      await serverService.findActiveServersWithRcon(maxAgeMinutes)

      expect(mockRepository.findActiveServersWithRcon).toHaveBeenCalledWith(maxAgeMinutes)
    })

    it("should return empty array when no active servers found", async () => {
      mockRepository.findActiveServersWithRcon.mockResolvedValue([])

      const result = await serverService.findActiveServersWithRcon()

      expect(result).toEqual([])
      expect(mockRepository.findActiveServersWithRcon).toHaveBeenCalledWith(undefined)
    })

    it("should handle repository errors", async () => {
      mockRepository.findActiveServersWithRcon.mockRejectedValue(new Error("Database error"))

      await expect(serverService.findActiveServersWithRcon()).rejects.toThrow("Database error")
      expect(mockRepository.findActiveServersWithRcon).toHaveBeenCalledWith(undefined)
    })
  })
})
