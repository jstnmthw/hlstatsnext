/**
 * PlayerRepository Unit Tests
 */

import type { DatabaseClient } from "@/database/client"
import { createMockDatabaseClient, type MockDatabaseClient } from "@/tests/mocks/database"
import { createMockLogger } from "@/tests/mocks/logger"
import type { EventConnect, Player } from "@repo/db/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PlayerRepository } from "./player.repository"

vi.mock("@/config/game.config", () => ({
  GameConfig: {
    getDefaultGame: vi.fn().mockReturnValue("cstrike"),
    getUnknownMap: vi.fn().mockReturnValue("unknown"),
  },
}))

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

  describe("createChatEvent", () => {
    it("should create a chat event with valid params", async () => {
      mockDatabase.mockPrisma.eventChat.create.mockResolvedValue({} as any)

      await expect(
        playerRepository.createChatEvent(1, 2, "de_dust2", "hello", 0),
      ).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.eventChat.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            playerId: 1,
            serverId: 2,
            map: "de_dust2",
            message: "hello",
            messageMode: 0,
          }),
        }),
      )
    })

    it("should throw for invalid playerId (0)", async () => {
      await expect(playerRepository.createChatEvent(0, 2, "de_dust2", "hello")).rejects.toThrow()
    })

    it("should throw for invalid serverId (0)", async () => {
      await expect(playerRepository.createChatEvent(1, 0, "de_dust2", "hello")).rejects.toThrow()
    })

    it("should use empty string when map is empty", async () => {
      mockDatabase.mockPrisma.eventChat.create.mockResolvedValue({} as any)

      await playerRepository.createChatEvent(1, 2, "", "hello")

      expect(mockDatabase.mockPrisma.eventChat.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ map: "" }),
        }),
      )
    })

    it("should propagate db errors", async () => {
      mockDatabase.mockPrisma.eventChat.create.mockRejectedValue(new Error("DB error"))

      await expect(playerRepository.createChatEvent(1, 2, "de_dust2", "hello")).rejects.toThrow(
        "DB error",
      )
    })
  })

  describe("createChangeNameEvent", () => {
    it("should create a change-name event with valid params", async () => {
      mockDatabase.mockPrisma.eventChangeName.create.mockResolvedValue({} as any)

      await expect(
        playerRepository.createChangeNameEvent(1, 2, "de_dust2", "OldName", "NewName"),
      ).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.eventChangeName.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serverId: 2,
            map: "de_dust2",
            playerId: 1,
            oldName: "OldName",
            newName: "NewName",
          }),
        }),
      )
    })

    it("should use empty string when map is empty (map || '' branch)", async () => {
      mockDatabase.mockPrisma.eventChangeName.create.mockResolvedValue({} as any)

      await playerRepository.createChangeNameEvent(1, 2, "", "OldName", "NewName")

      expect(mockDatabase.mockPrisma.eventChangeName.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ map: "" }),
        }),
      )
    })

    it("should use 0 for playerId when playerId <= 0 (playerId > 0 ? playerId : 0 branch)", async () => {
      mockDatabase.mockPrisma.eventChangeName.create.mockResolvedValue({} as any)

      await playerRepository.createChangeNameEvent(-5, 2, "de_dust2", "OldName", "NewName")

      expect(mockDatabase.mockPrisma.eventChangeName.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ playerId: 0 }),
        }),
      )
    })

    it("should throw for invalid serverId (0)", async () => {
      await expect(
        playerRepository.createChangeNameEvent(1, 0, "de_dust2", "OldName", "NewName"),
      ).rejects.toThrow()
    })

    it("should propagate db errors", async () => {
      mockDatabase.mockPrisma.eventChangeName.create.mockRejectedValue(new Error("DB error"))

      await expect(
        playerRepository.createChangeNameEvent(1, 2, "de_dust2", "OldName", "NewName"),
      ).rejects.toThrow("DB error")
    })
  })

  describe("createChangeTeamEvent", () => {
    it("should create a change-team event with valid params", async () => {
      mockDatabase.mockPrisma.eventChangeTeam.create.mockResolvedValue({} as any)

      await expect(
        playerRepository.createChangeTeamEvent(1, 2, "de_dust2", "CT"),
      ).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.eventChangeTeam.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serverId: 2,
            map: "de_dust2",
            playerId: 1,
            team: "CT",
          }),
        }),
      )
    })

    it("should use empty string when map is empty", async () => {
      mockDatabase.mockPrisma.eventChangeTeam.create.mockResolvedValue({} as any)

      await playerRepository.createChangeTeamEvent(1, 2, "", "CT")

      expect(mockDatabase.mockPrisma.eventChangeTeam.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ map: "" }),
        }),
      )
    })

    it("should use 0 for playerId when playerId <= 0", async () => {
      mockDatabase.mockPrisma.eventChangeTeam.create.mockResolvedValue({} as any)

      await playerRepository.createChangeTeamEvent(0, 2, "de_dust2", "T")

      expect(mockDatabase.mockPrisma.eventChangeTeam.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ playerId: 0 }),
        }),
      )
    })

    it("should throw for invalid serverId (0)", async () => {
      await expect(playerRepository.createChangeTeamEvent(1, 0, "de_dust2", "CT")).rejects.toThrow()
    })
  })

  describe("createChangeRoleEvent", () => {
    it("should create a change-role event with valid params", async () => {
      mockDatabase.mockPrisma.eventChangeRole.create.mockResolvedValue({} as any)

      await expect(
        playerRepository.createChangeRoleEvent(1, 2, "de_dust2", "assault"),
      ).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.eventChangeRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serverId: 2,
            map: "de_dust2",
            playerId: 1,
            role: "assault",
          }),
        }),
      )
    })

    it("should use empty string when map is empty", async () => {
      mockDatabase.mockPrisma.eventChangeRole.create.mockResolvedValue({} as any)

      await playerRepository.createChangeRoleEvent(1, 2, "", "support")

      expect(mockDatabase.mockPrisma.eventChangeRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ map: "" }),
        }),
      )
    })

    it("should use 0 for playerId when playerId <= 0", async () => {
      mockDatabase.mockPrisma.eventChangeRole.create.mockResolvedValue({} as any)

      await playerRepository.createChangeRoleEvent(-1, 2, "de_dust2", "sniper")

      expect(mockDatabase.mockPrisma.eventChangeRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ playerId: 0 }),
        }),
      )
    })

    it("should throw for invalid serverId (0)", async () => {
      await expect(
        playerRepository.createChangeRoleEvent(1, 0, "de_dust2", "assault"),
      ).rejects.toThrow()
    })
  })

  describe("createSuicideEvent", () => {
    it("should create a suicide event with valid params", async () => {
      mockDatabase.mockPrisma.eventSuicide.create.mockResolvedValue({} as any)

      await expect(
        playerRepository.createSuicideEvent(1, 2, "de_dust2", "world"),
      ).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.eventSuicide.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serverId: 2,
            map: "de_dust2",
            playerId: 1,
            weapon: "world",
          }),
        }),
      )
    })

    it("should use empty string when map is empty", async () => {
      mockDatabase.mockPrisma.eventSuicide.create.mockResolvedValue({} as any)

      await playerRepository.createSuicideEvent(1, 2, "", "world")

      expect(mockDatabase.mockPrisma.eventSuicide.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ map: "" }),
        }),
      )
    })

    it("should use 0 for playerId when playerId <= 0", async () => {
      mockDatabase.mockPrisma.eventSuicide.create.mockResolvedValue({} as any)

      await playerRepository.createSuicideEvent(0, 2, "de_dust2", "world")

      expect(mockDatabase.mockPrisma.eventSuicide.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ playerId: 0 }),
        }),
      )
    })

    it("should use empty string when weapon is undefined (weapon || '' branch)", async () => {
      mockDatabase.mockPrisma.eventSuicide.create.mockResolvedValue({} as any)

      await playerRepository.createSuicideEvent(1, 2, "de_dust2", undefined)

      expect(mockDatabase.mockPrisma.eventSuicide.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ weapon: "" }),
        }),
      )
    })

    it("should throw for invalid serverId (0)", async () => {
      await expect(playerRepository.createSuicideEvent(1, 0, "de_dust2", "world")).rejects.toThrow()
    })
  })

  describe("createTeamkillEvent", () => {
    it("should create a teamkill event with valid params", async () => {
      mockDatabase.mockPrisma.eventTeamkill.create.mockResolvedValue({} as any)

      await expect(
        playerRepository.createTeamkillEvent(1, 2, 3, "de_dust2", "ak47"),
      ).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.eventTeamkill.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serverId: 3,
            map: "de_dust2",
            killerId: 1,
            victimId: 2,
            weapon: "ak47",
          }),
        }),
      )
    })

    it("should use 0 for killerId when killerId <= 0", async () => {
      mockDatabase.mockPrisma.eventTeamkill.create.mockResolvedValue({} as any)

      await playerRepository.createTeamkillEvent(0, 2, 3, "de_dust2", "ak47")

      expect(mockDatabase.mockPrisma.eventTeamkill.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ killerId: 0 }),
        }),
      )
    })

    it("should use 0 for victimId when victimId <= 0", async () => {
      mockDatabase.mockPrisma.eventTeamkill.create.mockResolvedValue({} as any)

      await playerRepository.createTeamkillEvent(1, -1, 3, "de_dust2", "ak47")

      expect(mockDatabase.mockPrisma.eventTeamkill.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ victimId: 0 }),
        }),
      )
    })

    it("should use empty string when weapon is empty (weapon || '' branch)", async () => {
      mockDatabase.mockPrisma.eventTeamkill.create.mockResolvedValue({} as any)

      await playerRepository.createTeamkillEvent(1, 2, 3, "de_dust2", "")

      expect(mockDatabase.mockPrisma.eventTeamkill.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ weapon: "" }),
        }),
      )
    })

    it("should use empty string when map is empty", async () => {
      mockDatabase.mockPrisma.eventTeamkill.create.mockResolvedValue({} as any)

      await playerRepository.createTeamkillEvent(1, 2, 3, "", "ak47")

      expect(mockDatabase.mockPrisma.eventTeamkill.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ map: "" }),
        }),
      )
    })

    it("should throw for invalid serverId (0)", async () => {
      await expect(
        playerRepository.createTeamkillEvent(1, 2, 0, "de_dust2", "ak47"),
      ).rejects.toThrow()
    })
  })

  describe("createEntryEvent", () => {
    it("should create an entry event with valid params", async () => {
      mockDatabase.mockPrisma.eventEntry.create.mockResolvedValue({} as any)

      await expect(playerRepository.createEntryEvent(1, 2, "de_dust2")).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.eventEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serverId: 2,
            map: "de_dust2",
            playerId: 1,
          }),
        }),
      )
    })

    it("should use empty string when map is empty", async () => {
      mockDatabase.mockPrisma.eventEntry.create.mockResolvedValue({} as any)

      await playerRepository.createEntryEvent(1, 2, "")

      expect(mockDatabase.mockPrisma.eventEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ map: "" }),
        }),
      )
    })

    it("should use 0 for playerId when playerId <= 0", async () => {
      mockDatabase.mockPrisma.eventEntry.create.mockResolvedValue({} as any)

      await playerRepository.createEntryEvent(-3, 2, "de_dust2")

      expect(mockDatabase.mockPrisma.eventEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ playerId: 0 }),
        }),
      )
    })

    it("should throw for invalid serverId (0)", async () => {
      await expect(playerRepository.createEntryEvent(1, 0, "de_dust2")).rejects.toThrow()
    })
  })

  describe("createConnectEvent", () => {
    it("should create a connect event with valid params", async () => {
      mockDatabase.mockPrisma.eventConnect.create.mockResolvedValue({} as any)

      await expect(
        playerRepository.createConnectEvent(1, 2, "de_dust2", "192.168.1.1"),
      ).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.eventConnect.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serverId: 2,
            map: "de_dust2",
            playerId: 1,
            ipAddress: "192.168.1.1",
          }),
        }),
      )
    })

    it("should use empty string when map is empty", async () => {
      mockDatabase.mockPrisma.eventConnect.create.mockResolvedValue({} as any)

      await playerRepository.createConnectEvent(1, 2, "", "192.168.1.1")

      expect(mockDatabase.mockPrisma.eventConnect.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ map: "" }),
        }),
      )
    })

    it("should use 0 for playerId when playerId <= 0", async () => {
      mockDatabase.mockPrisma.eventConnect.create.mockResolvedValue({} as any)

      await playerRepository.createConnectEvent(0, 2, "de_dust2", "10.0.0.1")

      expect(mockDatabase.mockPrisma.eventConnect.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ playerId: 0 }),
        }),
      )
    })

    it("should use empty string when ipAddress is empty (ipAddress || '' branch)", async () => {
      mockDatabase.mockPrisma.eventConnect.create.mockResolvedValue({} as any)

      await playerRepository.createConnectEvent(1, 2, "de_dust2", "")

      expect(mockDatabase.mockPrisma.eventConnect.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ipAddress: "" }),
        }),
      )
    })

    it("should throw for invalid serverId (0)", async () => {
      await expect(
        playerRepository.createConnectEvent(1, 0, "de_dust2", "10.0.0.1"),
      ).rejects.toThrow()
    })
  })

  describe("createDisconnectEvent", () => {
    it("should create a disconnect event with valid params and backfill (lastConnect found)", async () => {
      mockDatabase.mockPrisma.eventDisconnect.create.mockResolvedValue({} as any)
      mockDatabase.mockPrisma.eventConnect.findFirst.mockResolvedValue({ id: 99 } as any)
      mockDatabase.mockPrisma.eventConnect.update.mockResolvedValue({} as any)

      await expect(
        playerRepository.createDisconnectEvent(1, 2, "de_dust2"),
      ).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.eventDisconnect.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serverId: 2,
            map: "de_dust2",
            playerId: 1,
          }),
        }),
      )
      expect(mockDatabase.mockPrisma.eventConnect.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 99 },
          data: { eventTimeDisconnect: expect.any(Date) },
        }),
      )
    })

    it("should skip backfill update when no lastConnect row is found", async () => {
      mockDatabase.mockPrisma.eventDisconnect.create.mockResolvedValue({} as any)
      mockDatabase.mockPrisma.eventConnect.findFirst.mockResolvedValue(null)

      await playerRepository.createDisconnectEvent(1, 2, "de_dust2")

      expect(mockDatabase.mockPrisma.eventConnect.update).not.toHaveBeenCalled()
    })

    it("should skip backfill entirely when playerId <= 0", async () => {
      mockDatabase.mockPrisma.eventDisconnect.create.mockResolvedValue({} as any)

      await playerRepository.createDisconnectEvent(0, 2, "de_dust2")

      expect(mockDatabase.mockPrisma.eventConnect.findFirst).not.toHaveBeenCalled()
      expect(mockDatabase.mockPrisma.eventConnect.update).not.toHaveBeenCalled()
    })

    it("should log warning and continue when backfill throws", async () => {
      mockDatabase.mockPrisma.eventDisconnect.create.mockResolvedValue({} as any)
      mockDatabase.mockPrisma.eventConnect.findFirst.mockRejectedValue(
        new Error("findFirst failed"),
      )

      await expect(
        playerRepository.createDisconnectEvent(1, 2, "de_dust2"),
      ).resolves.toBeUndefined()

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it("should log warning and continue when eventDisconnect.create throws", async () => {
      const createError = new Error("Disconnect create failed")
      mockDatabase.mockPrisma.eventDisconnect.create.mockRejectedValue(createError)
      mockDatabase.mockPrisma.eventConnect.findFirst.mockResolvedValue(null)

      await expect(
        playerRepository.createDisconnectEvent(1, 2, "de_dust2"),
      ).resolves.toBeUndefined()

      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it("should throw for invalid serverId (0)", async () => {
      await expect(playerRepository.createDisconnectEvent(1, 0, "de_dust2")).rejects.toThrow()
    })
  })

  describe("logEventFrag", () => {
    it("should log an event frag with all optional params", async () => {
      mockDatabase.mockPrisma.eventFrag.create.mockResolvedValue({} as any)

      await expect(
        playerRepository.logEventFrag(
          1,
          2,
          3,
          "de_dust2",
          "ak47",
          true,
          "assault",
          "sniper",
          100,
          200,
          300,
          400,
          500,
          600,
        ),
      ).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.eventFrag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            killerId: 1,
            victimId: 2,
            serverId: 3,
            map: "de_dust2",
            weapon: "ak47",
            headshot: 1,
            killerRole: "assault",
            victimRole: "sniper",
            posX: 100,
            posY: 200,
            posZ: 300,
            posVictimX: 400,
            posVictimY: 500,
            posVictimZ: 600,
          }),
        }),
      )
    })

    it("should use empty string / null for missing optional params", async () => {
      mockDatabase.mockPrisma.eventFrag.create.mockResolvedValue({} as any)

      await playerRepository.logEventFrag(1, 2, 3, "", "ak47", false)

      expect(mockDatabase.mockPrisma.eventFrag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            map: "",
            headshot: 0,
            killerRole: "",
            victimRole: "",
            posX: null,
            posY: null,
            posZ: null,
            posVictimX: null,
            posVictimY: null,
            posVictimZ: null,
          }),
        }),
      )
    })

    it("should throw for invalid killerId (0)", async () => {
      await expect(
        playerRepository.logEventFrag(0, 2, 3, "de_dust2", "ak47", false),
      ).rejects.toThrow()
    })

    it("should throw for invalid victimId (0)", async () => {
      await expect(
        playerRepository.logEventFrag(1, 0, 3, "de_dust2", "ak47", false),
      ).rejects.toThrow()
    })

    it("should throw for invalid serverId (0)", async () => {
      await expect(
        playerRepository.logEventFrag(1, 2, 0, "de_dust2", "ak47", false),
      ).rejects.toThrow()
    })
  })

  describe("update (extended branch coverage)", () => {
    it("should clamp skill to 0 when increment would underflow UNSIGNED column", async () => {
      // Pre-read returns a player with skill=100; increment=-9999 → clamped to 0
      mockDatabase.mockPrisma.player.findUnique.mockResolvedValueOnce(
        createMockPlayer({ playerId: 1, skill: 100 }),
      )
      mockDatabase.mockPrisma.player.update.mockResolvedValueOnce(
        createMockPlayer({ playerId: 1, skill: 0 }),
      )

      const result = await playerRepository.update(1, { skill: { increment: -9999 } as any })

      expect(result).toBeDefined()
      // findUnique called once to pre-read; update called once with bounded value
      expect(mockDatabase.mockPrisma.player.findUnique).toHaveBeenCalledTimes(1)
      expect(mockDatabase.mockPrisma.player.update).toHaveBeenCalledTimes(1)
      expect(mockDatabase.mockPrisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ skill: 0 }),
        }),
      )
    })

    it("should create player with direct values when record not found during non-increment update", async () => {
      const notFoundError = new Error(
        "An operation failed because it depends on one or more record that were required but not found",
      )

      // Non-increment path: player.update rejects with not-found; outer catch creates player
      mockDatabase.mockPrisma.player.update.mockRejectedValueOnce(notFoundError)
      mockDatabase.mockPrisma.player.create.mockResolvedValue(
        createMockPlayer({ playerId: 1, kills: 5 }),
      )

      const result = await playerRepository.update(1, { kills: 5 })

      expect(result).toBeDefined()
      expect(mockDatabase.mockPrisma.player.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            playerId: 1,
            kills: 5,
          }),
        }),
      )
    })

    it("should handle non-increment values in the conversion loop during record-not-found", async () => {
      const notFoundError = new Error(
        "An operation failed because it depends on one or more record that were required but not found",
      )

      // Non-increment path with direct value - exercises the else branch in the conversion loop
      mockDatabase.mockPrisma.player.update.mockRejectedValueOnce(notFoundError)
      mockDatabase.mockPrisma.player.create.mockResolvedValue(
        createMockPlayer({ playerId: 1, lastName: "DirectValue" }),
      )

      const result = await playerRepository.update(1, { lastName: "DirectValue" })

      expect(result).toBeDefined()
      expect(mockDatabase.mockPrisma.player.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastName: "DirectValue",
          }),
        }),
      )
    })
  })

  describe("findManyById", () => {
    it("should return empty map for empty IDs array", async () => {
      const result = await playerRepository.findManyById([])

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
      expect(mockDatabase.mockPrisma.player.findMany).not.toHaveBeenCalled()
    })

    it("should return populated map for valid IDs", async () => {
      const players = [createMockPlayer({ playerId: 1 }), createMockPlayer({ playerId: 2 })]
      mockDatabase.mockPrisma.player.findMany.mockResolvedValue(players)

      const result = await playerRepository.findManyById([1, 2])

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(2)
      expect(result.get(1)).toEqual(players[0])
      expect(result.get(2)).toEqual(players[1])
    })

    it("should respect include and select options", async () => {
      mockDatabase.mockPrisma.player.findMany.mockResolvedValue([])
      const options = { include: { stats: true }, select: { playerId: true } }

      await playerRepository.findManyById([1], options)

      expect(mockDatabase.mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: options.include,
          select: options.select,
        }),
      )
    })

    it("should return empty map on error", async () => {
      mockDatabase.mockPrisma.player.findMany.mockRejectedValue(new Error("DB error"))

      const result = await playerRepository.findManyById([1, 2])

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    })
  })

  describe("createMany", () => {
    it("should return immediately for empty operations", async () => {
      await expect(playerRepository.createMany([])).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.player.createMany).not.toHaveBeenCalled()
    })

    it("should call createMany for non-empty operations", async () => {
      mockDatabase.mockPrisma.player.createMany.mockResolvedValue({ count: 2 })

      const operations = [
        { data: createMockPlayer({ playerId: 10 }) },
        { data: createMockPlayer({ playerId: 11 }) },
      ]

      await playerRepository.createMany(operations)

      expect(mockDatabase.mockPrisma.player.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      )
    })
  })

  describe("updateMany", () => {
    it("should return immediately for empty operations", async () => {
      await expect(playerRepository.updateMany([])).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.player.update).not.toHaveBeenCalled()
    })

    it("should perform individual updates for each operation", async () => {
      mockDatabase.mockPrisma.player.update.mockResolvedValue(createMockPlayer({ playerId: 1 }))

      const operations = [
        { id: 1, data: { skill: 1100 } },
        { id: 2, data: { skill: 1200 } },
      ]

      await playerRepository.updateMany(operations)

      // Each player should be updated individually via Promise.all
      expect(mockDatabase.mockPrisma.player.update).toHaveBeenCalledTimes(2)
    })

    it("should group and execute operations with different field sets", async () => {
      mockDatabase.mockPrisma.player.update.mockResolvedValue(createMockPlayer({ playerId: 1 }))

      const operations = [
        { id: 1, data: { skill: 1100 } },
        { id: 2, data: { kills: 5 } },
        { id: 3, data: { skill: 1200 } },
      ]

      await playerRepository.updateMany(operations)

      // All 3 updates should be called
      expect(mockDatabase.mockPrisma.player.update).toHaveBeenCalledTimes(3)
    })
  })

  describe("getPlayerRank", () => {
    it("should return rank when player is found", async () => {
      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(
        createMockPlayer({ playerId: 1, skill: 1500 }),
      )
      mockDatabase.mockPrisma.player.count.mockResolvedValue(4)

      const rank = await playerRepository.getPlayerRank(1)

      expect(rank).toBe(5) // 4 players with higher skill + 1
      expect(mockDatabase.mockPrisma.player.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { skill: { gt: 1500 } } }),
      )
    })

    it("should return null when player is not found", async () => {
      mockDatabase.mockPrisma.player.findUnique.mockResolvedValue(null)

      const rank = await playerRepository.getPlayerRank(999)

      expect(rank).toBeNull()
      expect(mockDatabase.mockPrisma.player.count).not.toHaveBeenCalled()
    })

    it("should throw when invalid playerId is supplied", async () => {
      await expect(playerRepository.getPlayerRank(0)).rejects.toThrow()
    })

    it("should propagate db error", async () => {
      mockDatabase.mockPrisma.player.findUnique.mockRejectedValue(new Error("DB failure"))

      await expect(playerRepository.getPlayerRank(1)).rejects.toThrow("DB failure")
    })
  })

  describe("getTotalPlayerCount", () => {
    it("should return the total player count", async () => {
      mockDatabase.mockPrisma.player.count.mockResolvedValue(42)

      const count = await playerRepository.getTotalPlayerCount()

      expect(count).toBe(42)
      expect(mockDatabase.mockPrisma.player.count).toHaveBeenCalled()
    })

    it("should propagate db error", async () => {
      mockDatabase.mockPrisma.player.count.mockRejectedValue(new Error("count failed"))

      await expect(playerRepository.getTotalPlayerCount()).rejects.toThrow("count failed")
    })
  })

  describe("getPlayerSessionStats", () => {
    it("should return null when no connect event is found", async () => {
      mockDatabase.mockPrisma.eventConnect.findFirst.mockResolvedValue(null)

      const result = await playerRepository.getPlayerSessionStats(1)

      expect(result).toBeNull()
    })

    it("should return session stats when a connect event is found", async () => {
      const sessionStart = new Date(Date.now() - 60_000)
      mockDatabase.mockPrisma.eventConnect.findFirst.mockResolvedValue({
        eventTime: sessionStart,
      } as any)
      mockDatabase.mockPrisma.eventFrag.count
        .mockResolvedValueOnce(5) // kills
        .mockResolvedValueOnce(2) // deaths

      const result = await playerRepository.getPlayerSessionStats(1)

      expect(result).not.toBeNull()
      expect(result?.kills).toBe(5)
      expect(result?.deaths).toBe(2)
      expect(result?.sessionTime).toBeGreaterThanOrEqual(0)
    })

    it("should throw for invalid playerId (0)", async () => {
      await expect(playerRepository.getPlayerSessionStats(0)).rejects.toThrow()
    })
  })

  describe("updatePlayerStatsBatch", () => {
    it("should return immediately for empty updates", async () => {
      await expect(playerRepository.updatePlayerStatsBatch([])).resolves.toBeUndefined()

      expect(mockDatabase.mockPrisma.player.updateMany).not.toHaveBeenCalled()
    })

    it("should group updates by skill delta and call updateMany for each group", async () => {
      mockDatabase.mockPrisma.player.updateMany.mockResolvedValue({ count: 2 })

      const updates = [
        { playerId: 1, skillDelta: 10 },
        { playerId: 2, skillDelta: 10 },
        { playerId: 3, skillDelta: -5 },
      ]

      await playerRepository.updatePlayerStatsBatch(updates)

      // Two distinct delta groups: +10 and -5
      expect(mockDatabase.mockPrisma.player.updateMany).toHaveBeenCalledTimes(2)
      expect(mockDatabase.mockPrisma.player.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId: { in: [1, 2] } },
          data: { skill: { increment: 10 } },
        }),
      )
      expect(mockDatabase.mockPrisma.player.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { playerId: { in: [3] } },
          data: { skill: { increment: -5 } },
        }),
      )
    })
  })

  describe("hasRecentConnect (additional branches)", () => {
    it("should return false immediately when playerId is 0 (early return branch)", async () => {
      const result = await playerRepository.hasRecentConnect(1, 0, 120_000)

      expect(result).toBe(false)
      expect(mockDatabase.mockPrisma.eventConnect.findFirst).not.toHaveBeenCalled()
    })

    it("should return false immediately when playerId is negative", async () => {
      const result = await playerRepository.hasRecentConnect(1, -5, 120_000)

      expect(result).toBe(false)
      expect(mockDatabase.mockPrisma.eventConnect.findFirst).not.toHaveBeenCalled()
    })
  })
})
