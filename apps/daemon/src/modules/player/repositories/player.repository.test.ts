/**
 * PlayerRepository Unit Tests
 */

import type { DatabaseClient } from "@/database/client"
import { createMockDatabaseClient, type MockDatabaseClient } from "@/tests/mocks/database"
import { createMockLogger } from "@/tests/mocks/logger"
import type { EventConnect, Player } from "@repo/db/client"
import { beforeEach, describe, expect, it } from "vitest"
import { PlayerRepository } from "./player.repository"

// Helper function to create a complete Player object with defaults
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
        lastEvent: new Date(),
      })

      mockDatabase.mockPrisma.player.create.mockResolvedValue(mockCreatedPlayer)

      const result = await playerRepository.create(playerData)

      expect(result).toEqual(mockCreatedPlayer)
      expect(mockDatabase.mockPrisma.player.create).toHaveBeenCalledWith({
        data: {
          lastName: playerData.lastName,
          game: playerData.game,
          skill: playerData.skill,
          createdAt: expect.any(Date),
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

  describe("upsertPlayer", () => {
    it("should create new player when none exists", async () => {
      const playerData = {
        lastName: "UpsertPlayer",
        game: "csgo",
        steamId: "76561198000000003",
        skill: 1200,
      }

      const mockCreatedPlayer = createMockPlayer({
        playerId: 42,
        ...playerData,
      })

      const mockUpsertResult = {
        player: mockCreatedPlayer,
        uniqueId: playerData.steamId,
        game: playerData.game,
        playerId: mockCreatedPlayer.playerId,
        merge: null,
      }

      mockDatabase.mockPrisma.playerUniqueId.upsert.mockResolvedValue(mockUpsertResult)

      const result = await playerRepository.upsertPlayer(playerData)

      expect(result).toEqual(mockCreatedPlayer)
      expect(mockDatabase.mockPrisma.playerUniqueId.upsert).toHaveBeenCalledWith({
        where: {
          uniqueId_game: {
            uniqueId: playerData.steamId,
            game: playerData.game,
          },
        },
        update: {
          player: {
            update: {
              lastName: playerData.lastName,
            },
          },
        },
        create: {
          uniqueId: playerData.steamId,
          game: playerData.game,
          player: {
            create: {
              lastName: playerData.lastName,
              game: playerData.game,
              skill: playerData.skill,
              createdAt: expect.any(Date),
            },
          },
        },
        include: {
          player: true,
        },
      })
    })

    it("should return existing player when one exists", async () => {
      const playerData = {
        lastName: "ExistingPlayer",
        game: "csgo",
        steamId: "76561198000000004",
        skill: 1000,
      }

      const existingPlayer = createMockPlayer({
        playerId: 99,
        lastName: "OldName",
        game: playerData.game,
      })

      const updatedPlayer = { ...existingPlayer, lastName: playerData.lastName }

      const mockUpsertResult = {
        player: updatedPlayer,
        uniqueId: playerData.steamId,
        game: playerData.game,
        playerId: existingPlayer.playerId,
        merge: null,
      }

      mockDatabase.mockPrisma.playerUniqueId.upsert.mockResolvedValue(mockUpsertResult)

      const result = await playerRepository.upsertPlayer(playerData)

      expect(result.playerId).toBe(99)
      expect(result.lastName).toBe(playerData.lastName) // Should be updated
      expect(mockDatabase.mockPrisma.playerUniqueId.upsert).toHaveBeenCalled()
    })

    it("should validate required parameters", async () => {
      const invalidData = {
        lastName: "",
        game: "csgo",
        steamId: "76561198000000005",
      }

      await expect(playerRepository.upsertPlayer(invalidData)).rejects.toThrow(
        "lastName, game, and steamId are required",
      )
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

  describe("hasRecentConnect", () => {
    it("returns true when a recent connect exists within window", async () => {
      const serverId = 10
      const playerId = 15
      const now = new Date()
      mockDatabase.mockPrisma.eventConnect.findFirst.mockResolvedValue({
        id: 1,
        eventTime: new Date(now.getTime() - 60_000),
        serverId: 10,
        map: "de_dust2",
        playerId: 15,
        ipAddress: "",
        hostname: "",
        hostgroup: "",
        eventTimeDisconnect: null,
      } as EventConnect)

      const result = await playerRepository.hasRecentConnect(serverId, playerId, 120_000)
      expect(result).toBe(true)
      expect(mockDatabase.mockPrisma.eventConnect.findFirst).toHaveBeenCalledWith({
        where: { serverId, playerId },
        orderBy: { id: "desc" },
        select: { eventTime: true },
      })
    })

    it("returns false when no connect exists or is outside window", async () => {
      const serverId = 10
      const playerId = 15
      const now = new Date()
      mockDatabase.mockPrisma.eventConnect.findFirst.mockResolvedValueOnce(null)
      const noRow = await playerRepository.hasRecentConnect(serverId, playerId, 120_000)
      expect(noRow).toBe(false)

      mockDatabase.mockPrisma.eventConnect.findFirst.mockResolvedValueOnce({
        id: 2,
        eventTime: new Date(now.getTime() - 300_000),
        serverId: 10,
        map: "de_dust2",
        playerId: 15,
        ipAddress: "",
        hostname: "",
        hostgroup: "",
        eventTimeDisconnect: null,
      } as EventConnect)
      const oldRow = await playerRepository.hasRecentConnect(serverId, playerId, 120_000)
      expect(oldRow).toBe(false)
    })
  })

  describe("upsertPlayerName", () => {
    it("should create PlayerName when missing", async () => {
      const playerId = 42
      const name = "AliasOne"
      await playerRepository.upsertPlayerName(playerId, name, { numUses: 1, lastUse: new Date() })

      expect(mockDatabase.mockPrisma.playerName.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId_name: { playerId, name } },
          create: expect.objectContaining({ playerId, name }),
        }),
      )
    })

    it("should increment counters on existing alias", async () => {
      const playerId = 7
      const name = "AliasTwo"
      const now = new Date()

      await playerRepository.upsertPlayerName(playerId, name, {
        kills: 1,
        headshots: 1,
        shots: 2,
        hits: 2,
        lastUse: now,
      })

      expect(mockDatabase.mockPrisma.playerName.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId_name: { playerId, name } },
          update: expect.objectContaining({
            kills: { increment: 1 },
            headshots: { increment: 1 },
            shots: { increment: 2 },
            hits: { increment: 2 },
            lastUse: now,
          }),
        }),
      )
    })

    it("should validate input", async () => {
      await expect(playerRepository.upsertPlayerName(0, "", {})).rejects.toThrow()
    })
  })
})
