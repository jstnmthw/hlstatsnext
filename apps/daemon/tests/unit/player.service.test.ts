import { describe, it, expect, vi, beforeEach } from "vitest"
import { PlayerService } from "../../src/services/player/player.service"
import { createMockDatabaseClient, createMockLogger } from "../types/test-mocks"
import type { DatabaseClient } from "../../src/database/client"

// Helper to build a mock DatabaseClient
function createDbMock() {
  const mockDb = createMockDatabaseClient()

  return {
    db: mockDb as unknown as DatabaseClient,
    spies: {
      transaction: mockDb.transaction,
      playerUpdate: mockDb.prisma.player.update,
      playerFindUnique: mockDb.prisma.player.findUnique,
      playerCreate: mockDb.prisma.player.create,
      playerUniqueIdFindUnique: mockDb.prisma.playerUniqueId.findUnique,
      eventEntryFindMany: mockDb.prisma.eventEntry.findMany,
    },
  }
}

describe("PlayerService", () => {
  let service: PlayerService
  let dbMock: ReturnType<typeof createDbMock>
  const loggerMock = createMockLogger()

  beforeEach(() => {
    dbMock = createDbMock()
    service = new PlayerService(dbMock.db, loggerMock)
  })

  describe("getPlayerRating", () => {
    it("fetches player rating from database", async () => {
      const mockPlayer = {
        skill: 1200,
        _count: {
          fragsAsKiller: 50,
        },
      }

      dbMock.spies.playerFindUnique.mockResolvedValueOnce(mockPlayer)

      const rating = await service.getPlayerRating(123)

      expect(rating).toEqual({
        playerId: 123,
        rating: 1200,
        confidence: 300, // 350 - 50
        volatility: 0.06,
        gamesPlayed: 50,
      })
      expect(dbMock.spies.playerFindUnique).toHaveBeenCalledWith({
        where: { playerId: 123 },
        select: {
          skill: true,
          _count: {
            select: {
              fragsAsKiller: true,
            },
          },
        },
      })
    })

    it("returns default rating for new players", async () => {
      dbMock.spies.playerFindUnique.mockResolvedValueOnce(null)

      const rating = await service.getPlayerRating(123)

      expect(rating).toEqual({
        playerId: 123,
        rating: 1000,
        confidence: 350,
        volatility: 0.06,
        gamesPlayed: 0,
      })
    })

    it("handles confidence reduction correctly", async () => {
      const mockPlayer = {
        skill: 1500,
        _count: {
          fragsAsKiller: 500, // More than MAX_CONFIDENCE_REDUCTION (300)
        },
      }

      dbMock.spies.playerFindUnique.mockResolvedValueOnce(mockPlayer)

      const rating = await service.getPlayerRating(123)

      expect(rating).toEqual({
        playerId: 123,
        rating: 1500,
        confidence: 50, // 350 - 300 (capped)
        volatility: 0.06,
        gamesPlayed: 500,
      })
    })

    it("handles database errors gracefully", async () => {
      const dbError = new Error("Database connection failed")
      dbMock.spies.playerFindUnique.mockRejectedValueOnce(dbError)

      const rating = await service.getPlayerRating(123)

      // Should return default rating on error
      expect(rating).toEqual({
        playerId: 123,
        rating: 1000,
        confidence: 350,
        volatility: 0.06,
        gamesPlayed: 0,
      })
      expect(loggerMock.error).toHaveBeenCalledWith(`Failed to get player rating for 123: ${dbError}`)
    })
  })

  describe("updatePlayerRatings", () => {
    it("updates multiple player ratings in a transaction", async () => {
      const updates = [
        { playerId: 1, newRating: 1200, gamesPlayed: 10 },
        { playerId: 2, newRating: 1100, gamesPlayed: 15 },
      ]

      await service.updatePlayerRatings(updates)

      expect(dbMock.spies.transaction).toHaveBeenCalledTimes(1)
    })

    it("handles empty update array", async () => {
      await service.updatePlayerRatings([])

      expect(dbMock.spies.transaction).toHaveBeenCalledTimes(1)
    })

    it("handles database errors", async () => {
      const dbError = new Error("Transaction failed")
      dbMock.spies.transaction.mockRejectedValueOnce(dbError)

      const updates = [{ playerId: 1, newRating: 1200, gamesPlayed: 10 }]

      await expect(service.updatePlayerRatings(updates)).rejects.toThrow(dbError)
      expect(loggerMock.error).toHaveBeenCalledWith(`Failed to update player ratings: ${dbError}`)
    })
  })

  describe("getRoundParticipants", () => {
    it("fetches round participants from database", async () => {
      const mockEvents = [
        {
          playerId: 1,
          player: { skill: 1200, teamkills: 0, kills: 5, deaths: 2 },
        },
        {
          playerId: 2,
          player: { skill: 1100, teamkills: 1, kills: 3, deaths: 4 },
        },
      ]

      dbMock.spies.eventEntryFindMany.mockResolvedValueOnce(mockEvents)

      const participants = await service.getRoundParticipants(123, 120)

      expect(participants).toEqual(mockEvents)
      expect(dbMock.spies.eventEntryFindMany).toHaveBeenCalledWith({
        where: {
          serverId: 123,
          eventTime: {
            gte: expect.any(Date),
          },
        },
        select: {
          playerId: true,
          player: {
            select: {
              skill: true,
              teamkills: true,
              kills: true,
              deaths: true,
            },
          },
        },
      })
    })

    it("handles empty participant list", async () => {
      dbMock.spies.eventEntryFindMany.mockResolvedValueOnce([])

      const participants = await service.getRoundParticipants(123, 120)

      expect(participants).toEqual([])
    })

    it("calculates correct time range", async () => {
      const now = 1672531200000 // Fixed timestamp
      vi.spyOn(Date, "now").mockReturnValue(now)
      dbMock.spies.eventEntryFindMany.mockResolvedValueOnce([])

      await service.getRoundParticipants(123, 120)

      const expectedStart = new Date(now - 120000) // 120 seconds * 1000ms

      expect(dbMock.spies.eventEntryFindMany).toHaveBeenCalledWith({
        where: {
          serverId: 123,
          eventTime: {
            gte: expectedStart,
          },
        },
        select: {
          playerId: true,
          player: {
            select: {
              skill: true,
              teamkills: true,
              kills: true,
              deaths: true,
            },
          },
        },
      })
    })

    it("handles database errors", async () => {
      const dbError = new Error("Query failed")
      dbMock.spies.eventEntryFindMany.mockRejectedValueOnce(dbError)

      await expect(service.getRoundParticipants(123, 120)).rejects.toThrow(dbError)
      expect(loggerMock.error).toHaveBeenCalledWith(`Failed to get round participants: ${dbError}`)
    })
  })

  describe("getOrCreatePlayer", () => {
    it("returns existing player ID when found", async () => {
      const mockUniqueId = {
        playerId: 123,
        player: { playerId: 123 },
      }

      dbMock.spies.playerUniqueIdFindUnique.mockResolvedValueOnce(mockUniqueId)

      const playerId = await service.getOrCreatePlayer("STEAM_1:0:12345", "TestPlayer", "cstrike")

      expect(playerId).toBe(123)
      expect(dbMock.spies.playerUniqueIdFindUnique).toHaveBeenCalledWith({
        where: {
          uniqueId_game: {
            uniqueId: "STEAM_1:0:12345",
            game: "cstrike",
          },
        },
        include: {
          player: true,
        },
      })
      expect(dbMock.spies.playerCreate).not.toHaveBeenCalled()
    })

    it("creates new player when not found", async () => {
      dbMock.spies.playerUniqueIdFindUnique.mockResolvedValueOnce(null)
      dbMock.spies.playerCreate.mockResolvedValueOnce({ playerId: 456 })

      const playerId = await service.getOrCreatePlayer("STEAM_1:0:67890", "NewPlayer", "cstrike")

      expect(playerId).toBe(456)
      expect(dbMock.spies.playerCreate).toHaveBeenCalledWith({
        data: {
          lastName: "NewPlayer",
          game: "cstrike",
          skill: 1000,
          uniqueIds: {
            create: {
              uniqueId: "STEAM_1:0:67890",
              game: "cstrike",
            },
          },
        },
      })
    })

    it("handles bot players correctly", async () => {
      dbMock.spies.playerUniqueIdFindUnique.mockResolvedValueOnce(null)
      dbMock.spies.playerCreate.mockResolvedValueOnce({ playerId: 789 })

      const playerId = await service.getOrCreatePlayer("BOT", "RAGE OF THE BOY", "cstrike")

      expect(playerId).toBe(789)
      expect(dbMock.spies.playerCreate).toHaveBeenCalledWith({
        data: {
          lastName: "RAGE OF THE BOY",
          game: "cstrike",
          skill: 1000,
          uniqueIds: {
            create: {
              uniqueId: "BOT_RAGE_OF_THE_BOY",
              game: "cstrike",
            },
          },
        },
      })
    })

    it("handles database errors", async () => {
      const dbError = new Error("DB connection failed")
      dbMock.spies.playerUniqueIdFindUnique.mockRejectedValue(dbError)
      await expect(service.getOrCreatePlayer("STEAM_ID_UNKNOWN", "New Player", "csgo")).rejects.toThrow(dbError)
      expect(loggerMock.error).toHaveBeenCalledWith(`Failed to get or create player: ${dbError}`)
    })
  })

  describe("updatePlayerStats", () => {
    it("updates player statistics with increments", async () => {
      const stats = {
        kills: 10,
        deaths: 5,
        headshots: 3,
        shots: 50,
        hits: 25,
      }

      await service.updatePlayerStats(123, stats)

      expect(dbMock.spies.playerUpdate).toHaveBeenCalledWith({
        where: { playerId: 123 },
        data: {
          kills: { increment: 10 },
          deaths: { increment: 5 },
          headshots: { increment: 3 },
          shots: { increment: 50 },
          hits: { increment: 25 },
        },
      })
    })

    it("handles partial stats updates", async () => {
      const stats = { kills: 1 }

      await service.updatePlayerStats(123, stats)

      expect(dbMock.spies.playerUpdate).toHaveBeenCalledWith({
        where: { playerId: 123 },
        data: {
          kills: { increment: 1 },
        },
      })
    })

    it("handles database errors", async () => {
      const dbError = new Error("Update failed")
      dbMock.spies.playerUpdate.mockRejectedValueOnce(dbError)

      await expect(service.updatePlayerStats(123, { kills: 1 })).rejects.toThrow(dbError)
      expect(loggerMock.error).toHaveBeenCalledWith(`Failed to update player stats for 123: ${dbError}`)
    })
  })
})
