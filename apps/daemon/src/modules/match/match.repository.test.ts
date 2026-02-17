/**
 * MatchRepository Unit Tests
 */

import { GameConfig } from "@/config/game.config"
import type { DatabaseClient } from "@/database/client"
import { createMockDatabaseClient, type MockDatabaseClient } from "@/tests/mocks/database"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockServerRecord } from "@/tests/mocks/server"
import type { Player, PlayerHistory } from "@repo/db/client"
import { beforeEach, describe, expect, it } from "vitest"
import { MatchRepository } from "./match.repository"

describe("MatchRepository", () => {
  let matchRepository: MatchRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: MockDatabaseClient & DatabaseClient

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    matchRepository = new MatchRepository(mockDatabase, mockLogger)
  })

  function createMockPlayer(overrides: Partial<Player> = {}): Player {
    return {
      playerId: 1,
      lastEvent: new Date(),
      connectionTime: 0,
      lastSkillChange: new Date(),
      lastName: "TestPlayer",
      lastAddress: "127.0.0.1",
      fullName: "",
      email: "",
      city: "",
      state: "",
      country: "",
      flag: "",
      lat: null,
      lng: null,
      clanId: null,
      kills: 0,
      deaths: 0,
      suicides: 0,
      skill: 1000,
      shots: 0,
      hits: 0,
      teamkills: 0,
      headshots: 0,
      killStreak: 0,
      deathStreak: 0,
      activity: 0,
      game: "csgo",
      hideRanking: 0,
      displayEvents: 1,
      blockAvatar: 0,
      mmrank: null,
      createdAt: new Date(),
      ...overrides,
    }
  }

  function createMockPlayerHistory(overrides: Partial<PlayerHistory> = {}): PlayerHistory {
    return {
      playerId: 1,
      eventTime: new Date(),
      connectionTime: 0,
      kills: 0,
      deaths: 0,
      suicides: 0,
      skill: 1000,
      shots: 0,
      hits: 0,
      game: GameConfig.getDefaultGame(),
      headshots: 0,
      teamkills: 0,
      killStreak: 0,
      deathStreak: 0,
      skillChange: 0,
      ...overrides,
    }
  }

  describe("createPlayerHistory daily aggregation", () => {
    it("creates new daily row when none exists", async () => {
      const playerId = 1
      const day = new Date(Date.UTC(2025, 7, 11))
      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(createMockPlayer({ playerId }))
      mockDatabase.mockPrisma.playerHistory.findUnique.mockResolvedValue(null)
      mockDatabase.mockPrisma.playerHistory.create.mockResolvedValue(
        createMockPlayerHistory({
          playerId,
          eventTime: day,
          kills: 2,
          deaths: 1,
          headshots: 1,
          skill: 1010,
        }),
      )

      await matchRepository.createPlayerHistory({
        playerId,
        eventTime: day,
        game: GameConfig.getDefaultGame(),
        kills: 2,
        deaths: 1,
        headshots: 1,
        skill: 1010,
      })

      expect(mockDatabase.mockPrisma.playerHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          playerId,
          eventTime: expect.any(Date),
          game: expect.any(String),
          kills: 2,
          deaths: 1,
          headshots: 1,
          skill: 1010,
        }),
      })
    })

    it("updates existing daily row by incrementing sums and maxing streaks", async () => {
      const playerId = 2
      const day = new Date(Date.UTC(2025, 7, 11))
      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(createMockPlayer({ playerId }))
      mockDatabase.mockPrisma.playerHistory.findUnique.mockResolvedValue(
        createMockPlayerHistory({
          playerId,
          eventTime: day,
          skill: 1005,
          skillChange: 5,
          killStreak: 3,
          deathStreak: 2,
        }),
      )
      mockDatabase.mockPrisma.playerHistory.update.mockResolvedValue(
        createMockPlayerHistory({ playerId, eventTime: day }),
      )

      await matchRepository.createPlayerHistory({
        playerId,
        eventTime: day,
        game: GameConfig.getDefaultGame(),
        kills: 1,
        deaths: 0,
        suicides: 0,
        shots: 5,
        hits: 4,
        headshots: 1,
        teamkills: 0,
        connectionTime: 12,
        killStreak: 4,
        deathStreak: 1,
        skill: 1010,
      })

      expect(mockDatabase.mockPrisma.playerHistory.update).toHaveBeenCalledWith({
        where: {
          eventTime_playerId_game: {
            eventTime: expect.any(Date),
            playerId,
            game: expect.any(String),
          },
        },
        data: expect.objectContaining({
          kills: { increment: 1 },
          shots: { increment: 5 },
          killStreak: 4,
          deathStreak: 2,
          skill: 1010,
          skillChange: { increment: expect.any(Number) },
        }),
      })
    })

    it("skips when player does not exist", async () => {
      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(null)
      await matchRepository.createPlayerHistory({
        playerId: 999,
        eventTime: new Date(),
      })
      expect(mockDatabase.mockPrisma.playerHistory.create).not.toHaveBeenCalled()
      expect(mockDatabase.mockPrisma.playerHistory.update).not.toHaveBeenCalled()
    })
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

  describe("getPlayerSkill", () => {
    it("should return player skill when found", async () => {
      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(
        createMockPlayer({ playerId: 1, skill: 1500 }),
      )

      const skill = await matchRepository.getPlayerSkill(1)
      expect(skill).toBe(1500)
    })

    it("should return null when player not found", async () => {
      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(null)

      const skill = await matchRepository.getPlayerSkill(999)
      expect(skill).toBeNull()
    })

    it("should throw for invalid player ID", async () => {
      await expect(matchRepository.getPlayerSkill(0)).rejects.toThrow()
    })
  })

  describe("incrementServerRounds", () => {
    it("should increment both mapRounds and rounds", async () => {
      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.incrementServerRounds(1)

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: expect.objectContaining({
          mapRounds: { increment: 1 },
          rounds: { increment: 1 },
        }),
      })
    })
  })

  describe("updateTeamWins (actual method)", () => {
    it("should increment tsWins and mapTsWins for TERRORIST", async () => {
      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.updateTeamWins(1, "TERRORIST")

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: expect.objectContaining({
          tsWins: { increment: 1 },
          mapTsWins: { increment: 1 },
        }),
      })
    })

    it("should increment ctWins and mapCtWins for CT", async () => {
      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.updateTeamWins(1, "CT")

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: expect.objectContaining({
          ctWins: { increment: 1 },
          mapCtWins: { increment: 1 },
        }),
      })
    })

    it("should not update anything for unknown team", async () => {
      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.updateTeamWins(1, "UNKNOWN")

      // updateServerStats should NOT be called when updates is empty
      expect(mockDatabase.mockPrisma.server.update).not.toHaveBeenCalled()
    })
  })

  describe("updateBombStats (actual method)", () => {
    it("should increment bombsPlanted for plant events", async () => {
      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.updateBombStats(1, "plant")

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: expect.objectContaining({
          bombsPlanted: { increment: 1 },
        }),
      })
    })

    it("should increment bombsDefused for defuse events", async () => {
      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.updateBombStats(1, "defuse")

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: expect.objectContaining({
          bombsDefused: { increment: 1 },
        }),
      })
    })
  })

  describe("resetMapStats (actual method)", () => {
    it("should reset map stats with player count", async () => {
      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.resetMapStats(1, "de_dust2", 16)

      expect(mockDatabase.mockPrisma.server.update).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: expect.objectContaining({
          activeMap: "de_dust2",
          mapChanges: { increment: 1 },
          mapRounds: 0,
          mapCtWins: 0,
          mapTsWins: 0,
          mapCtShots: 0,
          mapCtHits: 0,
          mapTsShots: 0,
          mapTsHits: 0,
          players: 16,
        }),
      })
    })

    it("should reset map stats without player count", async () => {
      mockDatabase.mockPrisma.server.update.mockResolvedValue(createMockServerRecord())

      await matchRepository.resetMapStats(1, "de_inferno")

      const callArgs = mockDatabase.mockPrisma.server.update.mock.calls[0]![0]
      expect(callArgs.data).toHaveProperty("activeMap", "de_inferno")
      expect(callArgs.data).not.toHaveProperty("players")
    })
  })

  describe("getLastKnownMap", () => {
    it("should return map when found", async () => {
      mockDatabase.mockPrisma.eventFrag.findFirst.mockResolvedValue({
        map: "de_dust2",
      } as any)

      const map = await matchRepository.getLastKnownMap(1)
      expect(map).toBe("de_dust2")
    })

    it("should return null when no map found", async () => {
      mockDatabase.mockPrisma.eventFrag.findFirst.mockResolvedValue(null)

      const map = await matchRepository.getLastKnownMap(1)
      expect(map).toBeNull()
    })

    it("should throw for invalid server ID", async () => {
      await expect(matchRepository.getLastKnownMap(0)).rejects.toThrow()
    })
  })

  describe("updateMapCount", () => {
    it("should upsert map count", async () => {
      mockDatabase.mockPrisma.mapCount.upsert.mockResolvedValue({} as any)

      await matchRepository.updateMapCount("cstrike", "de_dust2", 10, 3)

      expect(mockDatabase.mockPrisma.mapCount.upsert).toHaveBeenCalledWith({
        where: { game_map: { game: "cstrike", map: "de_dust2" } },
        create: { game: "cstrike", map: "de_dust2", kills: 10, headshots: 3 },
        update: { kills: { increment: 10 }, headshots: { increment: 3 } },
      })
    })

    it("should throw for missing game", async () => {
      await expect(matchRepository.updateMapCount("", "de_dust2", 1, 0)).rejects.toThrow()
    })

    it("should throw for missing map", async () => {
      await expect(matchRepository.updateMapCount("cstrike", "", 1, 0)).rejects.toThrow()
    })
  })

  describe("createPlayerHistory validation", () => {
    it("should throw when playerId is missing", async () => {
      await expect(
        matchRepository.createPlayerHistory({
          playerId: 0,
          eventTime: new Date(),
        }),
      ).rejects.toThrow()
    })

    it("should throw when eventTime is missing", async () => {
      await expect(
        matchRepository.createPlayerHistory({
          playerId: 1,
          eventTime: undefined as unknown as Date,
        }),
      ).rejects.toThrow()
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
