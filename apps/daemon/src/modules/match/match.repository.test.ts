/**
 * MatchRepository Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { MatchRepository } from "./match.repository"
import { createMockLogger } from "../../tests/mocks/logger"
import { createMockDatabaseClient, type MockDatabaseClient } from "../../tests/mocks/database"
import type { DatabaseClient } from "@/database/client"
import { createMockServerRecord } from "../../tests/mocks/server"

describe("MatchRepository", () => {
  let matchRepository: MatchRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: MockDatabaseClient & DatabaseClient

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    matchRepository = new MatchRepository(mockDatabase, mockLogger)
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
        activeMap: "de_dust2",
      }

      await matchRepository.updateServerStats(serverId, updates)

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: updates,
      })
    })

    it("should handle partial updates", async () => {
      const serverId = 2
      const updates = { players: 5 }

      await matchRepository.updateServerStats(serverId, updates)

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
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

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalled()
    })

    it("should handle empty updates", async () => {
      const serverId = 1
      const updates = {}

      await matchRepository.updateServerStats(serverId, updates)

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: updates,
      })
    })
  })

  describe("findServerById", () => {
    it("should find server by ID", async () => {
      const serverId = 1

      mockDatabase.mockPrisma.server.findUnique.mockResolvedValue(createMockServerRecord())

      const result = await matchRepository.findServerById(serverId)

      expect(result).toBeDefined()
      expect(mockDatabase.mockPrisma.server.findUnique).toHaveBeenCalledWith({
        where: { serverId },
        include: undefined,
        select: undefined,
      })
    })

    it("should return null for non-existent server", async () => {
      const serverId = 999

      mockDatabase.mockPrisma.server.findUnique.mockResolvedValue(null)

      const result = await matchRepository.findServerById(serverId)

      expect(result).toBeNull()
      expect(mockDatabase.mockPrisma.server.findUnique).toHaveBeenCalledWith({
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

      mockDatabase.mockPrisma.server.findUnique.mockResolvedValue(createMockServerRecord())

      await matchRepository.findServerById(serverId, options)

      expect(mockDatabase.mockPrisma.server.findUnique).toHaveBeenCalledWith({
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

      mockDatabase.mockPrisma.server.findUnique.mockResolvedValue(createMockServerRecord())

      await matchRepository.findServerById(serverId, options)

      // Verify the method was called without throwing
      expect(mockDatabase.mockPrisma.server.findUnique).toHaveBeenCalled()
    })
  })

  describe("incrementServerRounds", () => {
    it("should increment server round count", async () => {
      const serverId = 1

      // Test that updateServerStats can be used for round increments
      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.updateServerStats(serverId, { rounds: { increment: 1 } })

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
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
        team === "ct" ? { ctWins: { increment: 1 } } : { t_wins: { increment: 1 } }

      await matchRepository.updateServerStats(serverId, teamWinUpdate)

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
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

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
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
        ctWins: 0,
        t_wins: 0,
        bomb_planted: 0,
        bomb_defused: 0,
        bomb_exploded: 0,
      }

      await matchRepository.updateServerStats(serverId, resetUpdate)

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: resetUpdate,
      })
    })
  })

  describe("Error handling", () => {
    it("should handle database errors in updateServerStats", async () => {
      const serverId = 1
      const updates = { players: 10 }

      mockDatabase.mockPrisma.server.update.mockRejectedValue(new Error("Database error"))

      await expect(matchRepository.updateServerStats(serverId, updates)).rejects.toThrow()
    })

    it("should handle database errors in findServerById", async () => {
      const serverId = 1

      mockDatabase.mockPrisma.server.findUnique.mockRejectedValue(new Error("Database error"))

      await expect(matchRepository.findServerById(serverId)).rejects.toThrow()
    })

    it("should handle constraint violations", async () => {
      const serverId = 1
      const updates = { players: -1 } // Potentially invalid value

      mockDatabase.mockPrisma.server.update.mockRejectedValue(new Error("Constraint violation"))

      await expect(matchRepository.updateServerStats(serverId, updates)).rejects.toThrow()
    })
  })

  describe("Edge cases", () => {
    it("should handle very large server IDs", async () => {
      const largeServerId = 999999999
      const updates = { players: 1 }

      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.updateServerStats(largeServerId, updates)

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId: largeServerId },
        data: updates,
      })
    })

    it("should handle complex nested updates", async () => {
      const serverId = 1
      const complexUpdates = {
        rounds: { increment: 1 },
        activeMap: "de_inferno",
        players: 20,
        status: "active",
        lastUpdate: new Date(),
      }

      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.updateServerStats(serverId, complexUpdates)

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: complexUpdates,
      })
    })

    it("should handle null and undefined values in updates", async () => {
      const serverId = 1
      const updatesWithNulls = {
        activeMap: null,
        description: undefined,
        players: 0,
      }

      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.updateServerStats(serverId, updatesWithNulls)

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId },
        data: updatesWithNulls,
      })
    })
  })
})
