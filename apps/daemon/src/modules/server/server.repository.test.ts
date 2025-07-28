/**
 * ServerRepository Unit Tests
 */

import type { DatabaseClient } from "@/database/client"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { ServerRepository } from "./server.repository"
import { createMockLogger } from "../../tests/mocks/logger"
import { createMockDatabaseClient } from "../../tests/mocks/database"

describe("ServerRepository", () => {
  let serverRepository: ServerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>

  const mockServerData = {
    serverId: 1,
    game: "cstrike",
    name: "Test CS Server",
    address: "192.168.1.100",
    port: 27015,
    country: "US",
    city: "Test City",
    last_event: 0,
    lat: null,
    lng: null,
    kills: 0,
    suicides: 0,
    headshots: 0,
    players: 0,
    current_map: "de_dust2",
    act_name: "",
    act_skill: 0.0,
    act_skillchange: 0,
    act_user: "",
    act_sort: 0,
    skill: 1000.0,
    skillchange: 0,
    diff_skill: 0.0,
    map_cstrike_act_css_assault: 0,
    map_cs_act_cs_747: 0,
    map_cs_act_as_oilrig: 0,
    map_de_act_de_dust: 0,
    map_de_act_de_dust2: 0,
    map_de_act_de_aztec: 0,
    map_de_act_de_cbble: 0,
    map_de_act_de_inferno: 0,
    map_de_act_de_nuke: 0,
    map_de_act_de_piranesi: 0,
    map_de_act_de_prodigy: 0,
    map_de_act_de_train: 0,
    map_de_act_de_vertigo: 0,
    map_cs_act_cs_assault: 0,
    map_cs_act_cs_backalley: 0,
    map_cs_act_cs_estate: 0,
    map_cs_act_cs_havana: 0,
    map_cs_act_cs_italy: 0,
    map_cs_act_cs_militia: 0,
    map_cs_act_cs_office: 0,
    map_as_act_as_oilrig: 0,
    map_ts_hits: 0,
  }

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()

    // Set up specific mock functions
    mockDatabase.prisma.server.findUnique = vi.fn()
    mockDatabase.prisma.server.findFirst = vi.fn()

    serverRepository = new ServerRepository(mockDatabase as unknown as DatabaseClient, mockLogger)
  })

  describe("Repository instantiation", () => {
    it("should create repository instance", () => {
      expect(serverRepository).toBeDefined()
      expect(serverRepository).toBeInstanceOf(ServerRepository)
    })

    it("should have required methods", () => {
      expect(serverRepository.findById).toBeDefined()
      expect(serverRepository.findByAddress).toBeDefined()
      expect(typeof serverRepository.findById).toBe("function")
      expect(typeof serverRepository.findByAddress).toBe("function")
    })
  })

  describe("findById", () => {
    it("should find server by ID", async () => {
      const serverId = 1
      vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValue(mockServerData as never)

      const result = await serverRepository.findById(serverId)

      expect(result).toEqual(mockServerData)
      expect(mockDatabase.prisma.server.findUnique).toHaveBeenCalledWith({
        where: { serverId },
        select: {
          serverId: true,
          game: true,
          name: true,
          address: true,
          port: true,
        },
      })
    })

    it("should return null when server not found", async () => {
      const serverId = 999
      vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValue(null)

      const result = await serverRepository.findById(serverId)

      expect(result).toBeNull()
      expect(mockDatabase.prisma.server.findUnique).toHaveBeenCalledWith({
        where: { serverId },
        select: {
          serverId: true,
          game: true,
          name: true,
          address: true,
          port: true,
        },
      })
    })

    it("should handle database errors gracefully", async () => {
      const serverId = 1
      const dbError = new Error("Database connection failed")
      vi.mocked(mockDatabase.prisma.server.findUnique).mockRejectedValue(dbError)

      const result = await serverRepository.findById(serverId)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to find server by ID ${serverId}: Error: Database connection failed`,
      )
    })

    it("should handle different server IDs", async () => {
      const testServerIds = [1, 100, 9999, 0, -1]

      for (const serverId of testServerIds) {
        const expectedServer = { ...mockServerData, serverId }
        vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValueOnce(
          expectedServer as never,
        )

        const result = await serverRepository.findById(serverId)
        expect(result).toEqual(expectedServer)
      }
    })

    it("should handle undefined and null server IDs", async () => {
      vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValue(null)

      const undefinedResult = await serverRepository.findById(undefined as unknown as number)
      const nullResult = await serverRepository.findById(null as unknown as number)

      expect(undefinedResult).toBeNull()
      expect(nullResult).toBeNull()
    })
  })

  describe("findByAddress", () => {
    it("should find server by address and port", async () => {
      const address = "192.168.1.100"
      const port = 27015
      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(mockServerData as never)

      const result = await serverRepository.findByAddress(address, port)

      expect(result).toEqual(mockServerData)
      expect(mockDatabase.prisma.server.findFirst).toHaveBeenCalledWith({
        where: {
          address,
          port,
        },
        select: {
          serverId: true,
          game: true,
          name: true,
          address: true,
          port: true,
        },
      })
    })

    it("should return null when server not found by address", async () => {
      const address = "192.168.1.200"
      const port = 27016
      vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValue(null)

      const result = await serverRepository.findByAddress(address, port)

      expect(result).toBeNull()
      expect(mockDatabase.prisma.server.findFirst).toHaveBeenCalledWith({
        where: {
          address,
          port,
        },
        select: {
          serverId: true,
          game: true,
          name: true,
          address: true,
          port: true,
        },
      })
    })

    it("should handle database errors gracefully", async () => {
      const address = "192.168.1.100"
      const port = 27015
      const dbError = new Error("Database timeout")
      vi.mocked(mockDatabase.prisma.server.findFirst).mockRejectedValue(dbError)

      const result = await serverRepository.findByAddress(address, port)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to find server by address ${address}:${port}: Error: Database timeout`,
      )
    })

    it("should handle different address formats", async () => {
      const testCases = [
        { address: "127.0.0.1", port: 27015 },
        { address: "localhost", port: 27015 },
        { address: "example.com", port: 27015 },
        { address: "::1", port: 27015 }, // IPv6
        { address: "0.0.0.0", port: 27015 },
      ]

      for (const { address, port } of testCases) {
        const expectedServer = { ...mockServerData, address, port }
        vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce(
          expectedServer as never,
        )

        const result = await serverRepository.findByAddress(address, port)
        expect(result).toEqual(expectedServer)
        expect(result?.address).toBe(address)
        expect(result?.port).toBe(port)
      }
    })

    it("should handle different port ranges", async () => {
      const address = "192.168.1.100"
      const testPorts = [1, 80, 443, 27015, 27016, 65535, 0]

      for (const port of testPorts) {
        const expectedServer = { ...mockServerData, port }
        vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce(
          expectedServer as never,
        )

        const result = await serverRepository.findByAddress(address, port)
        expect(result).toEqual(expectedServer)
        expect(result?.port).toBe(port)
      }
    })

    it("should handle empty and invalid addresses", async () => {
      const testCases = [
        { address: "", port: 27015 },
        { address: " ", port: 27015 },
        { address: "invalid-address", port: 27015 },
      ]

      for (const { address, port } of testCases) {
        vi.mocked(mockDatabase.prisma.server.findFirst).mockResolvedValueOnce(null)

        const result = await serverRepository.findByAddress(address, port)
        expect(result).toBeNull()
      }
    })
  })

  describe("Error scenarios", () => {
    it("should handle network-related database errors", async () => {
      const networkError = new Error("ECONNREFUSED")
      vi.mocked(mockDatabase.prisma.server.findUnique).mockRejectedValue(networkError)

      const result = await serverRepository.findById(1)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to find server by ID 1: Error: ECONNREFUSED",
      )
    })

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Query timeout")
      vi.mocked(mockDatabase.prisma.server.findFirst).mockRejectedValue(timeoutError)

      const result = await serverRepository.findByAddress("192.168.1.100", 27015)

      expect(result).toBeNull()
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to find server by address 192.168.1.100:27015: Error: Query timeout",
      )
    })

    it("should handle malformed data responses", async () => {
      // Simulate malformed response from database
      const malformedData = { unexpected: "data" }
      vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValue(malformedData as never)

      const result = await serverRepository.findById(1)

      expect(result).toEqual(malformedData)
    })
  })

  describe("Integration scenarios", () => {
    it("should handle multiple concurrent findById calls", async () => {
      const serverIds = [1, 2, 3, 4, 5]
      const promises = serverIds.map((id) => {
        const serverData = { ...mockServerData, serverId: id }
        vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValueOnce(serverData as never)
        return serverRepository.findById(id)
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
        { serverId: 2, shouldFail: true },
        { serverId: 3, shouldSucceed: true },
      ]

      const promises = testCases.map(({ serverId, shouldSucceed, shouldFail }) => {
        if (shouldSucceed) {
          const serverData = { ...mockServerData, serverId }
          vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValueOnce(
            serverData as never,
          )
        } else if (shouldFail) {
          vi.mocked(mockDatabase.prisma.server.findUnique).mockRejectedValueOnce(
            new Error("Database error"),
          )
        } else {
          vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValueOnce(null)
        }
        return serverRepository.findById(serverId)
      })

      const results = await Promise.all(promises)

      expect(results[0]).toEqual({ ...mockServerData, serverId: 1 })
      expect(results[1]).toBeNull() // Error case returns null
      expect(results[2]).toEqual({ ...mockServerData, serverId: 3 })
    })

    it("should handle different game types correctly", async () => {
      const gameTypes = ["cstrike", "css", "csgo", "tf2", "dod", "hl2dm"]

      for (const game of gameTypes) {
        const serverData = { ...mockServerData, game }
        vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValueOnce(serverData as never)

        const result = await serverRepository.findById(1)
        expect(result?.game).toBe(game)
      }
    })

    it("should correctly preserve all server fields", async () => {
      const completeServerData = {
        serverId: 42,
        game: "cstrike",
        name: "My Awesome CS Server [24/7]",
        address: "cs-server.example.com",
        port: 27015,
      }

      vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValue(
        completeServerData as never,
      )

      const result = await serverRepository.findById(42)

      expect(result).toEqual(completeServerData)
      expect(Object.keys(result!)).toEqual(["serverId", "game", "name", "address", "port"])
    })
  })
})
