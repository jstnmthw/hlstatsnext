/**
 * MatchRepository Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { MatchRepository } from "./match.repository"
import { createMockLogger } from "../../test-support/mocks/logger"
import { createMockDatabaseClient } from "../../test-support/mocks/database"
import type { DatabaseClient } from "@/database/client"
import type { ServerRecord } from "./match.types"

// Helper to create a complete server record for mocking
function createMockServerRecord(overrides: Partial<any> = {}): any {
  return {
    serverId: 1,
    address: "",
    port: 0,
    name: "Test Server",
    sortorder: 0,
    game: "csgo",
    publicaddress: "",
    statusurl: null,
    rcon_password: "",
    kills: 0,
    players: 0,
    rounds: 0,
    suicides: 0,
    headshots: 0,
    bombs_planted: 0,
    bombs_defused: 0,
    ct_wins: 0,
    ts_wins: 0,
    act_players: 0,
    max_players: 0,
    act_map: "",
    map_rounds: 0,
    map_ct_wins: 0,
    map_ts_wins: 0,
    map_started: 0,
    map_changes: 0,
    ct_shots: 0,
    ct_hits: 0,
    ts_shots: 0,
    ts_hits: 0,
    map_ct_shots: 0,
    map_ct_hits: 0,
    map_ts_shots: 0,
    map_ts_hits: 0,
    lat: null,
    lng: null,
    city: "",
    country: "",
    last_event: 0,
    ...overrides,
  }
}

describe("MatchRepository", () => {
  let matchRepository: MatchRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    matchRepository = new MatchRepository(mockDatabase as unknown as DatabaseClient, mockLogger)
  })

  describe("Repository instantiation", () => {
    it("should create repository instance", () => {
      expect(matchRepository).toBeDefined()
      expect(matchRepository).toBeInstanceOf(MatchRepository)
    })

    it("should have required methods", () => {
      expect(matchRepository.updateServerStats).toBeDefined()
      expect(matchRepository.findServerById).toBeDefined()
      expect(typeof matchRepository.updateServerStats).toBe("function")
      expect(typeof matchRepository.findServerById).toBe("function")
    })
  })

  describe("updateServerStats", () => {
    it("should update server statistics", async () => {
      const serverId = 1
      const updates = {
        rounds: { increment: 1 },
        players: 10,
        act_map: "de_dust2",
      }

      mockDatabase.prisma.server.update.mockResolvedValue(
        createMockServerRecord({
          serverId,
          rounds: 100,
          players: 10,
          act_map: "de_dust2",
        }),
      )

      await matchRepository.updateServerStats(serverId, updates)

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: updates,
      })
    })

    it("should handle partial updates", async () => {
      const serverId = 2
      const updates = { players: 5 }

      mockDatabase.prisma.server.update.mockResolvedValue(
        createMockServerRecord({
          serverId,
          players: 5,
        }),
      )

      await matchRepository.updateServerStats(serverId, updates)

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: updates,
      })
    })

    it("should validate server ID", async () => {
      const invalidServerId = 0
      const updates = { players: 1 }

      await expect(matchRepository.updateServerStats(invalidServerId, updates)).rejects.toThrow()
    })

    it("should handle transaction options", async () => {
      const serverId = 1
      const updates = { rounds: { increment: 1 } }
      const options = { transaction: mockDatabase.prisma }

      await matchRepository.updateServerStats(serverId, updates, options)

      // Verify the method was called without throwing
      expect(mockDatabase.prisma.server.update).toHaveBeenCalled()
    })

    it("should handle empty updates", async () => {
      const serverId = 1
      const updates = {}

      mockDatabase.prisma.server.update.mockResolvedValue(createMockServerRecord({ serverId }))

      await matchRepository.updateServerStats(serverId, updates)

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: updates,
      })
    })
  })

  describe("findServerById", () => {
    it("should find server by ID", async () => {
      const serverId = 1
      const mockServer = createMockServerRecord({
        serverId: 1,
        game: "csgo",
        act_map: "de_dust2",
      })

      mockDatabase.prisma.server.findUnique.mockResolvedValue(mockServer)

      const result = await matchRepository.findServerById(serverId)

      expect(result).toEqual(mockServer)
      expect(mockDatabase.prisma.server.findUnique).toHaveBeenCalledWith({
        where: { serverId },
        include: undefined,
        select: undefined,
      })
    })

    it("should return null for non-existent server", async () => {
      const serverId = 999

      mockDatabase.prisma.server.findUnique.mockResolvedValue(null)

      const result = await matchRepository.findServerById(serverId)

      expect(result).toBeNull()
      expect(mockDatabase.prisma.server.findUnique).toHaveBeenCalledWith({
        where: { serverId },
        include: undefined,
        select: undefined,
      })
    })

    it("should handle find options", async () => {
      const serverId = 1
      const options = {
        include: { players: true },
        select: { serverId: true, game: true },
      }

      mockDatabase.prisma.server.findUnique.mockResolvedValue(
        createMockServerRecord({
          serverId: 1,
          game: "csgo",
        }),
      )

      await matchRepository.findServerById(serverId, options)

      expect(mockDatabase.prisma.server.findUnique).toHaveBeenCalledWith({
        where: { serverId },
        include: options.include,
        select: options.select,
      })
    })

    it("should validate server ID", async () => {
      const invalidServerId = -1

      await expect(matchRepository.findServerById(invalidServerId)).rejects.toThrow()
    })

    it("should handle transaction options", async () => {
      const serverId = 1
      const options = { transaction: mockDatabase.prisma }

      mockDatabase.prisma.server.findUnique.mockResolvedValue(createMockServerRecord({ serverId }))

      await matchRepository.findServerById(serverId, options)

      // Verify the method was called without throwing
      expect(mockDatabase.prisma.server.findUnique).toHaveBeenCalled()
    })
  })

  describe("incrementServerRounds", () => {
    it("should increment server round count", async () => {
      const serverId = 1

      // Test that updateServerStats can be used for round increments
      mockDatabase.prisma.server.update.mockResolvedValue(
        createMockServerRecord({ serverId, rounds: 1 }),
      )

      await matchRepository.updateServerStats(serverId, { rounds: { increment: 1 } })

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: { rounds: { increment: 1 } },
      })
    })
  })

  describe("updateTeamWins", () => {
    it("should update team win statistics", async () => {
      const serverId = 1
      const team = "ct"

      // Test using updateServerStats for team wins
      const teamWinUpdate =
        team === "ct" ? { ct_wins: { increment: 1 } } : { t_wins: { increment: 1 } }

      await matchRepository.updateServerStats(serverId, teamWinUpdate)

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: teamWinUpdate,
      })
    })
  })

  describe("updateBombStats", () => {
    it("should update bomb statistics", async () => {
      const serverId = 1
      const bombDefused = true

      // Test using updateServerStats for bomb stats
      const bombUpdate = bombDefused
        ? { bomb_defused: { increment: 1 } }
        : { bomb_exploded: { increment: 1 } }

      await matchRepository.updateServerStats(serverId, bombUpdate)

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: bombUpdate,
      })
    })
  })

  describe("resetMapStats", () => {
    it("should reset map-specific statistics", async () => {
      const serverId = 1

      // Test using updateServerStats for map reset
      const resetUpdate = {
        rounds: 0,
        ct_wins: 0,
        t_wins: 0,
        bomb_planted: 0,
        bomb_defused: 0,
        bomb_exploded: 0,
      }

      await matchRepository.updateServerStats(serverId, resetUpdate)

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: resetUpdate,
      })
    })
  })

  describe("Error handling", () => {
    it("should handle database errors in updateServerStats", async () => {
      const serverId = 1
      const updates = { players: 10 }

      mockDatabase.prisma.server.update.mockRejectedValue(new Error("Database error"))

      await expect(matchRepository.updateServerStats(serverId, updates)).rejects.toThrow()
    })

    it("should handle database errors in findServerById", async () => {
      const serverId = 1

      mockDatabase.prisma.server.findUnique.mockRejectedValue(new Error("Database error"))

      await expect(matchRepository.findServerById(serverId)).rejects.toThrow()
    })

    it("should handle constraint violations", async () => {
      const serverId = 1
      const updates = { players: -1 } // Potentially invalid value

      mockDatabase.prisma.server.update.mockRejectedValue(new Error("Constraint violation"))

      await expect(matchRepository.updateServerStats(serverId, updates)).rejects.toThrow()
    })
  })

  describe("Edge cases", () => {
    it("should handle very large server IDs", async () => {
      const largeServerId = 999999999
      const updates = { players: 1 }

      mockDatabase.prisma.server.update.mockResolvedValue(
        createMockServerRecord({ serverId: largeServerId }),
      )

      await matchRepository.updateServerStats(largeServerId, updates)

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId: largeServerId },
        data: updates,
      })
    })

    it("should handle complex nested updates", async () => {
      const serverId = 1
      const complexUpdates = {
        rounds: { increment: 1 },
        act_map: "de_inferno",
        players: 20,
        status: "active",
        lastUpdate: new Date(),
      }

      mockDatabase.prisma.server.update.mockResolvedValue(createMockServerRecord({ serverId }))

      await matchRepository.updateServerStats(serverId, complexUpdates)

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: complexUpdates,
      })
    })

    it("should handle null and undefined values in updates", async () => {
      const serverId = 1
      const updatesWithNulls = {
        act_map: null,
        description: undefined,
        players: 0,
      }

      mockDatabase.prisma.server.update.mockResolvedValue(createMockServerRecord({ serverId }))

      await matchRepository.updateServerStats(serverId, updatesWithNulls)

      expect(mockDatabase.prisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: updatesWithNulls,
      })
    })
  })
})
