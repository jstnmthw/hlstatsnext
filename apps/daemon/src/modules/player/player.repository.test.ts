/**
 * PlayerRepository Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { PlayerRepository } from "./player.repository"
import { createMockLogger } from "../../test-support/mocks/logger"
import { createMockDatabaseClient } from "../../test-support/mocks/database"
import type { Player } from "@repo/database/client"

describe("PlayerRepository", () => {
  let playerRepository: PlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockDatabase = createMockDatabaseClient()
    playerRepository = new PlayerRepository(mockDatabase, mockLogger)
  })

  describe("Repository instantiation", () => {
    it("should create repository instance", () => {
      expect(playerRepository).toBeDefined()
      expect(playerRepository).toBeInstanceOf(PlayerRepository)
    })

    it("should have required methods", () => {
      expect(playerRepository.findById).toBeDefined()
      expect(playerRepository.findByUniqueId).toBeDefined()
      expect(playerRepository.create).toBeDefined()
      expect(playerRepository.update).toBeDefined()
      expect(playerRepository.findTopPlayers).toBeDefined()
      expect(typeof playerRepository.findById).toBe("function")
      expect(typeof playerRepository.findByUniqueId).toBe("function")
    })
  })

  describe("findById", () => {
    it("should find player by ID", async () => {
      const playerId = 1
      const mockPlayer: Partial<Player> = {
        playerId: 1,
        lastName: "TestPlayer",
        game: "csgo",
        skill: 1000,
      }

      mockDatabase.prisma.player.findUnique.mockResolvedValue(mockPlayer as Player)

      const result = await playerRepository.findById(playerId)

      expect(result).toEqual(mockPlayer)
      expect(mockDatabase.prisma.player.findUnique).toHaveBeenCalledWith({
        where: { playerId },
        include: undefined,
        select: undefined,
      })
    })

    it("should return null for non-existent player", async () => {
      const playerId = 999

      mockDatabase.prisma.player.findUnique.mockResolvedValue(null)

      const result = await playerRepository.findById(playerId)

      expect(result).toBeNull()
      expect(mockDatabase.prisma.player.findUnique).toHaveBeenCalledWith({
        where: { playerId },
        include: undefined,
        select: undefined,
      })
    })

    it("should handle find options", async () => {
      const playerId = 1
      const options = {
        include: { stats: true },
        select: { playerId: true, lastName: true },
      }

      mockDatabase.prisma.player.findUnique.mockResolvedValue({
        playerId: 1,
        lastName: "TestPlayer",
      } as Player)

      await playerRepository.findById(playerId, options)

      expect(mockDatabase.prisma.player.findUnique).toHaveBeenCalledWith({
        where: { playerId },
        include: options.include,
        select: options.select,
      })
    })

    it("should validate player ID", async () => {
      const invalidPlayerId = 0

      await expect(playerRepository.findById(invalidPlayerId)).rejects.toThrow()
    })
  })

  describe("findByUniqueId", () => {
    it("should find player by unique ID", async () => {
      const uniqueId = "76561198000000000"
      const game = "csgo"
      const mockPlayer: Partial<Player> = {
        playerId: 1,
        lastName: "TestPlayer",
        game: "csgo",
      }

      const mockUniqueIdEntry = {
        uniqueId,
        playerId: 1,
        game,
        merge: null,
        player: mockPlayer, // Include the player relation
      }

      mockDatabase.prisma.playerUniqueId.findUnique.mockResolvedValue(mockUniqueIdEntry)
      mockDatabase.prisma.player.findUnique.mockResolvedValue(mockPlayer as Player)

      const result = await playerRepository.findByUniqueId(uniqueId, game)

      expect(result).toEqual(mockPlayer)
      expect(mockDatabase.prisma.playerUniqueId.findUnique).toHaveBeenCalledWith({
        where: {
          uniqueId_game: {
            uniqueId,
            game,
          },
        },
        include: {
          player: true,
        },
      })
    })

    it("should return null when unique ID not found", async () => {
      const uniqueId = "76561198000000000"
      const game = "csgo"

      mockDatabase.prisma.playerUniqueId.findUnique.mockResolvedValue(null)

      const result = await playerRepository.findByUniqueId(uniqueId, game)

      expect(result).toBeNull()
    })

    it("should validate required parameters", async () => {
      await expect(playerRepository.findByUniqueId("", "csgo")).rejects.toThrow(
        "uniqueId and game are required",
      )

      await expect(playerRepository.findByUniqueId("12345", "")).rejects.toThrow(
        "uniqueId and game are required",
      )
    })
  })

  describe("create", () => {
    it("should create new player", async () => {
      const playerData = {
        lastName: "NewPlayer",
        game: "csgo",
        steamId: "76561198000000001",
        skill: 1000,
      }

      const mockCreatedPlayer: Partial<Player> = {
        playerId: 1,
        ...playerData,
        last_event: Math.floor(Date.now() / 1000),
      }

      mockDatabase.prisma.player.create.mockResolvedValue(mockCreatedPlayer as Player)

      const result = await playerRepository.create(playerData)

      expect(result).toEqual(mockCreatedPlayer)
      expect(mockDatabase.prisma.player.create).toHaveBeenCalledWith({
        data: {
          lastName: playerData.lastName,
          game: playerData.game,
          skill: playerData.skill,
          uniqueIds: {
            create: {
              uniqueId: playerData.steamId,
              game: playerData.game,
            },
          },
        },
      })
    })

    it("should handle create options", async () => {
      const playerData = {
        lastName: "NewPlayer",
        game: "csgo",
        steamId: "76561198000000002",
      }
      const options = { transaction: mockDatabase.prisma }

      mockDatabase.prisma.player.create.mockResolvedValue({ playerId: 1 } as Player)

      await playerRepository.create(playerData, options)

      // Verify the method was called without throwing
      expect(mockDatabase.prisma.player.create).toHaveBeenCalled()
    })
  })

  describe("update", () => {
    it("should update player data", async () => {
      const playerId = 1
      const updateData = {
        lastName: "UpdatedPlayer",
        skill: 1200,
        kills: 10,
      }

      const mockUpdatedPlayer: Partial<Player> = {
        playerId,
        ...updateData,
      }

      mockDatabase.prisma.player.update.mockResolvedValue(mockUpdatedPlayer as Player)

      const result = await playerRepository.update(playerId, updateData)

      expect(result).toEqual(mockUpdatedPlayer)
      expect(mockDatabase.prisma.player.update).toHaveBeenCalledWith({
        where: { playerId },
        data: updateData,
      })
    })

    it("should handle partial updates", async () => {
      const playerId = 1
      const updateData = { skill: 1500 }

      mockDatabase.prisma.player.update.mockResolvedValue({
        playerId,
        skill: 1500,
      } as Player)

      await playerRepository.update(playerId, updateData)

      expect(mockDatabase.prisma.player.update).toHaveBeenCalledWith({
        where: { playerId },
        data: updateData,
      })
    })

    it("should handle update options", async () => {
      const playerId = 1
      const updateData = { skill: 1300 }
      const options = { transaction: mockDatabase.prisma }

      mockDatabase.prisma.player.update.mockResolvedValue({ playerId } as Player)

      await playerRepository.update(playerId, updateData, options)

      // Verify the method was called without throwing
      expect(mockDatabase.prisma.player.update).toHaveBeenCalled()
    })
  })

  describe("findTopPlayers", () => {
    it("should find top players by skill", async () => {
      const limit = 10
      const game = "csgo"
      const includeHidden = false

      const mockTopPlayers: Partial<Player>[] = [
        { playerId: 1, lastName: "Player1", skill: 2000 },
        { playerId: 2, lastName: "Player2", skill: 1800 },
        { playerId: 3, lastName: "Player3", skill: 1600 },
      ]

      mockDatabase.prisma.player.findMany.mockResolvedValue(mockTopPlayers as Player[])

      const result = await playerRepository.findTopPlayers(limit, game, includeHidden)

      expect(result).toEqual(mockTopPlayers)
      expect(mockDatabase.prisma.player.findMany).toHaveBeenCalledWith({
        where: {
          game,
          hideranking: includeHidden ? undefined : 0,
        },
        orderBy: { skill: "desc" },
        take: limit,
      })
    })

    it("should include hidden players when specified", async () => {
      const limit = 5
      const game = "csgo"
      const includeHidden = true

      mockDatabase.prisma.player.findMany.mockResolvedValue([])

      await playerRepository.findTopPlayers(limit, game, includeHidden)

      expect(mockDatabase.prisma.player.findMany).toHaveBeenCalledWith({
        where: {
          game,
          hideranking: undefined,
        },
        orderBy: { skill: "desc" },
        take: limit,
      })
    })
  })

  describe("Error handling", () => {
    it("should handle database errors gracefully", async () => {
      const playerId = 1

      mockDatabase.prisma.player.findUnique.mockRejectedValue(
        new Error("Database connection failed"),
      )

      await expect(playerRepository.findById(playerId)).rejects.toThrow()
    })

    it("should handle invalid player ID", async () => {
      const invalidPlayerId = -1

      await expect(playerRepository.findById(invalidPlayerId)).rejects.toThrow()
    })
  })

  describe("Edge cases", () => {
    it("should handle very large player IDs", async () => {
      const largePlayerId = 999999999

      mockDatabase.prisma.player.findUnique.mockResolvedValue(null)

      const result = await playerRepository.findById(largePlayerId)

      expect(result).toBeNull()
      expect(mockDatabase.prisma.player.findUnique).toHaveBeenCalledWith({
        where: { playerId: largePlayerId },
        include: undefined,
        select: undefined,
      })
    })

    it("should handle special characters in unique IDs", async () => {
      const specialUniqueId = "STEAM_1:0:12345"
      const game = "csgo"

      mockDatabase.prisma.playerUniqueId.findUnique.mockResolvedValue(null)

      const result = await playerRepository.findByUniqueId(specialUniqueId, game)

      expect(result).toBeNull()
      expect(mockDatabase.prisma.playerUniqueId.findUnique).toHaveBeenCalledWith({
        where: {
          uniqueId_game: {
            uniqueId: specialUniqueId,
            game,
          },
        },
        include: {
          player: true,
        },
      })
    })

    it("should handle empty update data", async () => {
      const playerId = 1
      const emptyUpdate = {}

      await expect(playerRepository.update(playerId, emptyUpdate)).rejects.toThrow(
        "No valid fields to update",
      )
    })
  })
})
