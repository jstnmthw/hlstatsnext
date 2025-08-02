/**
 * PlayerRepository Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { PlayerRepository } from "./player.repository"
import { createMockLogger } from "../../tests/mocks/logger"
import { createMockDatabaseClient, type MockDatabaseClient } from "../../tests/mocks/database"
import type { Player } from "@repo/database/client"
import type { DatabaseClient } from "@/database/client"

// Helper function to create a complete Player object with defaults
function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    playerId: 1,
    last_event: new Date(),
    connection_time: 0,
    last_skill_change: new Date(),
    lastName: "TestPlayer",
    lastAddress: "127.0.0.1",
    fullName: "",
    email: "",
    homepage: "",
    icq: 0,
    city: "",
    state: "",
    country: "",
    flag: "",
    lat: null,
    lng: null,
    clan: null,
    kills: 0,
    deaths: 0,
    suicides: 0,
    skill: 1000,
    shots: 0,
    hits: 0,
    teamkills: 0,
    headshots: 0,
    kill_streak: 0,
    death_streak: 0,
    activity: 0,
    game: "csgo",
    hideranking: 0,
    displayEvents: 1,
    blockavatar: 0,
    mmrank: null,
    created_at: new Date(),
    ...overrides,
  }
}

describe("PlayerRepository", () => {
  let playerRepository: PlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockDatabase: MockDatabaseClient & DatabaseClient

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
      const mockPlayer = createMockPlayer({
        playerId: 1,
        lastName: "TestPlayer",
        game: "csgo",
        skill: 1000,
      })

      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(mockPlayer)

      const result = await playerRepository.findById(playerId)

      expect(result).toEqual(mockPlayer)
      expect(mockDatabase.mockPrisma.player.findUnique).toHaveBeenCalledWith({
        where: { playerId },
        include: undefined,
        select: undefined,
      })
    })

    it("should return null for non-existent player", async () => {
      const playerId = 999

      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(null)

      const result = await playerRepository.findById(playerId)

      expect(result).toBeNull()
      expect(mockDatabase.mockPrisma.player.findUnique).toHaveBeenCalledWith({
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

      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(
        createMockPlayer({
          playerId: 1,
          lastName: "TestPlayer",
        }),
      )

      await playerRepository.findById(playerId, options)

      expect(mockDatabase.mockPrisma.player.findUnique).toHaveBeenCalledWith({
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
      const mockPlayer = createMockPlayer({
        playerId: 1,
        lastName: "TestPlayer",
        game: "csgo",
      })

      const mockUniqueIdEntry = {
        uniqueId,
        playerId: 1,
        game,
        merge: null,
        player: mockPlayer, // Include the player relation
      }

      mockDatabase.mockPrisma.playerUniqueId.findUnique.mockResolvedValue(mockUniqueIdEntry)
      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(mockPlayer)

      const result = await playerRepository.findByUniqueId(uniqueId, game)

      expect(result).toEqual(mockPlayer)
      expect(mockDatabase.mockPrisma.playerUniqueId.findUnique).toHaveBeenCalledWith({
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

      mockDatabase.mockPrisma.playerUniqueId.findUnique.mockResolvedValue(null)

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

      const mockCreatedPlayer = createMockPlayer({
        playerId: 1,
        ...playerData,
        last_event: new Date(),
      })

      mockDatabase.mockPrisma.player.create.mockResolvedValue(mockCreatedPlayer)

      const result = await playerRepository.create(playerData)

      expect(result).toEqual(mockCreatedPlayer)
      expect(mockDatabase.mockPrisma.player.create).toHaveBeenCalledWith({
        data: {
          lastName: playerData.lastName,
          game: playerData.game,
          skill: playerData.skill,
          created_at: expect.any(Date),
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

      mockDatabase.mockPrisma.player.create.mockResolvedValue(createMockPlayer({ playerId: 1 }))

      await playerRepository.create(playerData, options)

      // Verify the method was called without throwing
      expect(mockDatabase.mockPrisma.player.create).toHaveBeenCalled()
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

      const mockUpdatedPlayer = createMockPlayer({
        playerId,
        ...updateData,
      })

      mockDatabase.mockPrisma.player.update.mockResolvedValue(mockUpdatedPlayer)

      const result = await playerRepository.update(playerId, updateData)

      expect(result).toEqual(mockUpdatedPlayer)
      expect(mockDatabase.mockPrisma.player.update).toHaveBeenCalledWith({
        where: { playerId },
        data: updateData,
      })
    })

    it("should handle partial updates", async () => {
      const playerId = 1
      const updateData = { skill: 1500 }

      mockDatabase.mockPrisma.player.update.mockResolvedValue(
        createMockPlayer({
          playerId,
          skill: 1500,
        }),
      )

      await playerRepository.update(playerId, updateData)

      expect(mockDatabase.mockPrisma.player.update).toHaveBeenCalledWith({
        where: { playerId },
        data: updateData,
      })
    })

    it("should handle update options", async () => {
      const playerId = 1
      const updateData = { skill: 1300 }
      const options = { transaction: mockDatabase.prisma }

      mockDatabase.mockPrisma.player.update.mockResolvedValue(createMockPlayer({ playerId }))

      await playerRepository.update(playerId, updateData, options)

      // Verify the method was called without throwing
      expect(mockDatabase.mockPrisma.player.update).toHaveBeenCalled()
    })
  })

  describe("findTopPlayers", () => {
    it("should find top players by skill", async () => {
      const limit = 10
      const game = "csgo"
      const includeHidden = false

      const mockTopPlayers: Player[] = [
        createMockPlayer({ playerId: 1, lastName: "Player1", skill: 2000 }),
        createMockPlayer({ playerId: 2, lastName: "Player2", skill: 1800 }),
        createMockPlayer({ playerId: 3, lastName: "Player3", skill: 1600 }),
      ]

      mockDatabase.mockPrisma.player.findMany.mockResolvedValue(mockTopPlayers)

      const result = await playerRepository.findTopPlayers(limit, game, includeHidden)

      expect(result).toEqual(mockTopPlayers)
      expect(mockDatabase.mockPrisma.player.findMany).toHaveBeenCalledWith({
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

      mockDatabase.mockPrisma.player.findMany.mockResolvedValue([])

      await playerRepository.findTopPlayers(limit, game, includeHidden)

      expect(mockDatabase.mockPrisma.player.findMany).toHaveBeenCalledWith({
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

      mockDatabase.mockPrisma.player.findUnique.mockRejectedValue(
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

      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(null)

      const result = await playerRepository.findById(largePlayerId)

      expect(result).toBeNull()
      expect(mockDatabase.mockPrisma.player.findUnique).toHaveBeenCalledWith({
        where: { playerId: largePlayerId },
        include: undefined,
        select: undefined,
      })
    })

    it("should handle special characters in unique IDs", async () => {
      const specialUniqueId = "STEAM_1:0:12345"
      const game = "csgo"

      mockDatabase.mockPrisma.playerUniqueId.findUnique.mockResolvedValue(null)

      const result = await playerRepository.findByUniqueId(specialUniqueId, game)

      expect(result).toBeNull()
      expect(mockDatabase.mockPrisma.playerUniqueId.findUnique).toHaveBeenCalledWith({
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
