import { describe, it, expect, vi, beforeEach } from "vitest"
import { PlayerService } from "../../src/services/player/player.service"
import type { DatabaseClient } from "../../src/database/client"

// Helper to build a mock DatabaseClient
function createDbMock() {
  const transaction = vi.fn()
  const playerUpdate = vi.fn()
  const playerFindUnique = vi.fn()
  const eventEntryFindMany = vi.fn()
  const getOrCreatePlayer = vi.fn()

  const db = {
    prisma: {
      player: {
        findUnique: playerFindUnique,
        update: playerUpdate,
      },
      eventEntry: {
        findMany: eventEntryFindMany,
      },
    },
    transaction,
    getOrCreatePlayer,
  } as unknown as DatabaseClient

  return {
    db,
    spies: {
      transaction,
      playerUpdate,
      playerFindUnique,
      eventEntryFindMany,
      getOrCreatePlayer,
    },
  }
}

describe("PlayerService", () => {
  let dbMock: ReturnType<typeof createDbMock>
  let service: PlayerService

  beforeEach(() => {
    dbMock = createDbMock()
    service = new PlayerService(dbMock.db)
  })

  describe("getPlayerRating", () => {
    it("fetches player rating from database", async () => {
      const mockPlayer = {
        skill: 1500,
        _count: {
          fragsAsKiller: 50,
        },
      }
      dbMock.spies.playerFindUnique.mockResolvedValueOnce(mockPlayer)

      const result = await service.getPlayerRating(123)

      expect(result).toEqual({
        playerId: 123,
        rating: 1500,
        confidence: 300, // 350 - 50 (capped at 300)
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

      const result = await service.getPlayerRating(123)

      expect(result).toEqual({
        playerId: 123,
        rating: 1000,
        confidence: 350,
        volatility: 0.06,
        gamesPlayed: 0,
      })
    })

    it("handles confidence reduction correctly", async () => {
      const mockPlayer = {
        skill: 2000,
        _count: {
          fragsAsKiller: 500, // More than MAX_CONFIDENCE_REDUCTION (300)
        },
      }
      dbMock.spies.playerFindUnique.mockResolvedValueOnce(mockPlayer)

      const result = await service.getPlayerRating(456)

      expect(result.confidence).toBe(50) // 350 - 300 (capped)
    })

    it("handles database errors gracefully", async () => {
      dbMock.spies.playerFindUnique.mockRejectedValueOnce(new Error("DB Error"))

      const result = await service.getPlayerRating(123)

      // Should return default rating on error
      expect(result).toEqual({
        playerId: 123,
        rating: 1000,
        confidence: 350,
        volatility: 0.06,
        gamesPlayed: 0,
      })
    })
  })

  describe("updatePlayerRatings", () => {
    it("updates multiple player ratings in a transaction", async () => {
      const mockTx = {
        player: {
          update: vi.fn(),
        },
      }
      dbMock.spies.transaction.mockImplementation(async (callback) => {
        return callback(mockTx)
      })

      const updates = [
        { playerId: 1, newRating: 1200, gamesPlayed: 10 },
        { playerId: 2, newRating: 800, gamesPlayed: 15 },
      ]

      await service.updatePlayerRatings(updates)

      expect(dbMock.spies.transaction).toHaveBeenCalledTimes(1)
      expect(mockTx.player.update).toHaveBeenCalledTimes(2)
    })

    it("handles empty update array", async () => {
      await service.updatePlayerRatings([])
      expect(dbMock.spies.transaction).toHaveBeenCalledTimes(1)
    })

    it("handles database errors", async () => {
      dbMock.spies.transaction.mockRejectedValueOnce(new Error("Transaction failed"))

      const updates = [{ playerId: 1, newRating: 1200, gamesPlayed: 10 }]

      await expect(service.updatePlayerRatings(updates)).rejects.toThrow("Transaction failed")
    })
  })

  describe("getRoundParticipants", () => {
    it("fetches round participants from database", async () => {
      const mockParticipants = [
        {
          playerId: 1,
          player: { skill: 1200, teamkills: 0, kills: 5, deaths: 2 },
        },
        {
          playerId: 2,
          player: { skill: 1100, teamkills: 1, kills: 3, deaths: 4 },
        },
      ]
      dbMock.spies.eventEntryFindMany.mockResolvedValueOnce(mockParticipants)

      const result = await service.getRoundParticipants(1, 120)

      expect(result).toEqual(mockParticipants)
      expect(dbMock.spies.eventEntryFindMany).toHaveBeenCalledWith({
        where: {
          serverId: 1,
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

      const result = await service.getRoundParticipants(1, 120)
      expect(result).toEqual([])
    })

    it("calculates correct time range", async () => {
      const now = Date.now()
      vi.spyOn(Date, "now").mockReturnValue(now)

      await service.getRoundParticipants(1, 120)

      const expectedStartTime = new Date(now - 120 * 1000)
      expect(dbMock.spies.eventEntryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventTime: {
              gte: expectedStartTime,
            },
          }),
        }),
      )
    })

    it("handles database errors", async () => {
      dbMock.spies.eventEntryFindMany.mockRejectedValueOnce(new Error("Query failed"))

      await expect(service.getRoundParticipants(1, 120)).rejects.toThrow("Query failed")
    })
  })

  describe("getOrCreatePlayer", () => {
    it("delegates to database client", async () => {
      dbMock.spies.getOrCreatePlayer.mockResolvedValueOnce(123)

      const result = await service.getOrCreatePlayer("STEAM_123", "TestPlayer", "cstrike")

      expect(result).toBe(123)
      expect(dbMock.spies.getOrCreatePlayer).toHaveBeenCalledWith("STEAM_123", "TestPlayer", "cstrike")
    })
  })

  describe("updatePlayerStats", () => {
    it("updates player statistics", async () => {
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
          ...stats,
          last_event: expect.any(Number),
        },
      })
    })

    it("handles partial stats updates", async () => {
      const stats = { kills: 1 }

      await service.updatePlayerStats(123, stats)

      expect(dbMock.spies.playerUpdate).toHaveBeenCalledWith({
        where: { playerId: 123 },
        data: {
          kills: 1,
          last_event: expect.any(Number),
        },
      })
    })

    it("handles database errors", async () => {
      dbMock.spies.playerUpdate.mockRejectedValueOnce(new Error("Update failed"))

      await expect(service.updatePlayerStats(123, { kills: 1 })).rejects.toThrow("Update failed")
    })
  })
})
