/**
 * Action Repository Tests
 *
 * Tests for action database operations.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { MockDatabaseClient } from "@/tests/mocks/database"
import { createMockDatabaseClient } from "@/tests/mocks/database"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ActionRepository } from "./action.repository"

describe("ActionRepository", () => {
  let repository: ActionRepository
  let mockDatabase: MockDatabaseClient & DatabaseClient
  let mockLogger: ILogger

  beforeEach(() => {
    mockDatabase = createMockDatabaseClient()
    mockLogger = createMockLogger()
    repository = new ActionRepository(mockDatabase, mockLogger)
  })

  describe("findActionByCode", () => {
    it("should find action with exact match including team", async () => {
      const mockAction = {
        id: 1,
        game: "cstrike",
        code: "defused_the_bomb",
        count: 0,
        rewardPlayer: 10,
        rewardTeam: 2,
        team: "CT",
        description: "Defused the bomb",
        forPlayerActions: "1",
        forPlayerPlayerActions: "0",
        forTeamActions: "0",
        forWorldActions: "0",
      }

      vi.mocked(mockDatabase.prisma.action.findFirst).mockResolvedValueOnce(mockAction)

      const result = await repository.findActionByCode("cstrike", "defused_the_bomb", "CT")

      expect(result).toEqual({
        id: 1,
        game: "cstrike",
        code: "defused_the_bomb",
        rewardPlayer: 10,
        rewardTeam: 2,
        team: "CT",
        description: "Defused the bomb",
        forPlayerActions: true,
        forPlayerPlayerActions: false,
        forTeamActions: false,
        forWorldActions: false,
      })
    })

    it("should fallback to lookup without team when exact match not found", async () => {
      const mockAction = {
        id: 2,
        game: "tf",
        code: "captured_point",
        count: 0,
        rewardPlayer: 5,
        rewardTeam: 3,
        team: "",
        description: "Captured a control point",
        forPlayerActions: "1",
        forPlayerPlayerActions: "0",
        forTeamActions: "1",
        forWorldActions: "0",
      }

      vi.mocked(mockDatabase.prisma.action.findFirst)
        .mockResolvedValueOnce(null) // First call with team
        .mockResolvedValueOnce(mockAction) // Fallback without team

      const result = await repository.findActionByCode("tf", "captured_point", "Red")

      expect(mockDatabase.prisma.action.findFirst).toHaveBeenCalledTimes(2)
      expect(result).toEqual({
        id: 2,
        game: "tf",
        code: "captured_point",
        rewardPlayer: 5,
        rewardTeam: 3,
        team: "",
        description: "Captured a control point",
        forPlayerActions: true,
        forPlayerPlayerActions: false,
        forTeamActions: true,
        forWorldActions: false,
      })
    })

    it("should return null when action not found", async () => {
      vi.mocked(mockDatabase.prisma.action.findFirst).mockResolvedValue(null)

      const result = await repository.findActionByCode("unknown", "unknown_action")

      expect(result).toBeNull()
    })

    it("should throw error on database failure", async () => {
      vi.mocked(mockDatabase.prisma.action.findFirst).mockRejectedValue(new Error("Database error"))

      await expect(repository.findActionByCode("cstrike", "test")).rejects.toThrow(
        "Failed to find action by code",
      )
    })
  })

  describe("logPlayerAction", () => {
    it("should log player action successfully", async () => {
      vi.mocked(mockDatabase.prisma.eventPlayerAction.create).mockResolvedValue({
        id: 1,
        eventTime: new Date(),
        playerId: 100,
        actionId: 1,
        serverId: 1,
        map: "de_dust2",
        bonus: 10,
        posX: null,
        posY: null,
        posZ: null,
      })

      await repository.logPlayerAction(100, 1, 1, "de_dust2", 10)

      expect(mockDatabase.prisma.eventPlayerAction.create).toHaveBeenCalledWith({
        data: {
          eventTime: expect.any(Date),
          playerId: 100,
          actionId: 1,
          serverId: 1,
          map: "de_dust2",
          bonus: 10,
        },
      })
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Player action logged successfully"),
      )
    })

    it("should use default bonus of 0", async () => {
      vi.mocked(mockDatabase.prisma.eventPlayerAction.create).mockResolvedValue({
        id: 1,
        eventTime: new Date(),
        playerId: 100,
        actionId: 1,
        serverId: 1,
        map: "de_dust2",
        bonus: 0,
        posX: null,
        posY: null,
        posZ: null,
      })

      await repository.logPlayerAction(100, 1, 1, "de_dust2")

      expect(mockDatabase.prisma.eventPlayerAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ bonus: 0 }),
      })
    })

    it("should throw error on database failure", async () => {
      vi.mocked(mockDatabase.prisma.eventPlayerAction.create).mockRejectedValue(
        new Error("Database error"),
      )

      await expect(repository.logPlayerAction(100, 1, 1, "de_dust2")).rejects.toThrow(
        "Failed to log player action",
      )
    })
  })

  describe("logPlayerPlayerAction", () => {
    it("should log player-player action successfully", async () => {
      vi.mocked(mockDatabase.prisma.eventPlayerPlayerAction.create).mockResolvedValue({
        id: 1,
        eventTime: new Date(),
        playerId: 100,
        victimId: 200,
        actionId: 1,
        serverId: 1,
        map: "de_dust2",
        bonus: 5,
        posX: null,
        posY: null,
        posZ: null,
        posVictimX: null,
        posVictimY: null,
        posVictimZ: null,
      })

      await repository.logPlayerPlayerAction(100, 200, 1, 1, "de_dust2", 5)

      expect(mockDatabase.prisma.eventPlayerPlayerAction.create).toHaveBeenCalledWith({
        data: {
          eventTime: expect.any(Date),
          playerId: 100,
          victimId: 200,
          actionId: 1,
          serverId: 1,
          map: "de_dust2",
          bonus: 5,
        },
      })
    })

    it("should throw error on database failure", async () => {
      vi.mocked(mockDatabase.prisma.eventPlayerPlayerAction.create).mockRejectedValue(
        new Error("Database error"),
      )

      await expect(repository.logPlayerPlayerAction(100, 200, 1, 1, "de_dust2")).rejects.toThrow(
        "Failed to log player-player action",
      )
    })
  })

  describe("logTeamActionForPlayer", () => {
    it("should log team action for player successfully", async () => {
      vi.mocked(mockDatabase.prisma.eventTeamBonus.create).mockResolvedValue({
        id: 1,
        eventTime: new Date(),
        playerId: 100,
        serverId: 1,
        actionId: 1,
        map: "de_dust2",
        bonus: 2,
      })

      await repository.logTeamActionForPlayer(100, 1, 1, "de_dust2", 2)

      expect(mockDatabase.prisma.eventTeamBonus.create).toHaveBeenCalledWith({
        data: {
          eventTime: expect.any(Date),
          playerId: 100,
          serverId: 1,
          actionId: 1,
          map: "de_dust2",
          bonus: 2,
        },
      })
    })

    it("should use 0 for invalid player IDs", async () => {
      vi.mocked(mockDatabase.prisma.eventTeamBonus.create).mockResolvedValue({
        id: 1,
        eventTime: new Date(),
        playerId: 0,
        serverId: 1,
        actionId: 1,
        map: "de_dust2",
        bonus: 2,
      })

      await repository.logTeamActionForPlayer(-1, 1, 1, "de_dust2", 2)

      expect(mockDatabase.prisma.eventTeamBonus.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ playerId: 0 }),
      })
    })

    it("should throw error on database failure", async () => {
      vi.mocked(mockDatabase.prisma.eventTeamBonus.create).mockRejectedValue(
        new Error("Database error"),
      )

      await expect(repository.logTeamActionForPlayer(100, 1, 1, "de_dust2")).rejects.toThrow(
        "Failed to log team action",
      )
    })
  })

  describe("logWorldAction", () => {
    it("should log world action successfully", async () => {
      vi.mocked(mockDatabase.prisma.eventWorldAction.create).mockResolvedValue({
        id: 1,
        eventTime: new Date(),
        serverId: 1,
        actionId: 1,
        map: "de_dust2",
        bonus: 0,
      })

      await repository.logWorldAction(1, 1, "de_dust2", 0)

      expect(mockDatabase.prisma.eventWorldAction.create).toHaveBeenCalledWith({
        data: {
          eventTime: expect.any(Date),
          serverId: 1,
          actionId: 1,
          map: "de_dust2",
          bonus: 0,
        },
      })
    })

    it("should throw error on database failure", async () => {
      vi.mocked(mockDatabase.prisma.eventWorldAction.create).mockRejectedValue(
        new Error("Database error"),
      )

      await expect(repository.logWorldAction(1, 1, "de_dust2")).rejects.toThrow(
        "Failed to log world action",
      )
    })
  })

  describe("logPlayerSuicide", () => {
    it("should log player suicide successfully", async () => {
      vi.mocked(mockDatabase.prisma.eventSuicide.create).mockResolvedValue({
        id: 1,
        eventTime: new Date(),
        serverId: 1,
        playerId: 100,
        map: "de_dust2",
        weapon: "world",
        posX: null,
        posY: null,
        posZ: null,
      })

      await repository.logPlayerSuicide(1, 100, "de_dust2", "world")

      expect(mockDatabase.prisma.eventSuicide.create).toHaveBeenCalledWith({
        data: {
          eventTime: expect.any(Date),
          serverId: 1,
          playerId: 100,
          map: "de_dust2",
          weapon: "world",
        },
      })
    })

    it("should log warning on database failure", async () => {
      vi.mocked(mockDatabase.prisma.eventSuicide.create).mockRejectedValue(
        new Error("Database error"),
      )

      await repository.logPlayerSuicide(1, 100, "de_dust2")

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to log suicide"),
      )
    })
  })

  describe("logTeamActionBatch", () => {
    it("should batch log team actions successfully", async () => {
      const teamActions = [
        { playerId: 100, serverId: 1, actionId: 1, map: "de_dust2", bonus: 2 },
        { playerId: 101, serverId: 1, actionId: 1, map: "de_dust2", bonus: 2 },
        { playerId: 102, serverId: 1, actionId: 1, map: "de_dust2", bonus: 2 },
      ]

      vi.mocked(mockDatabase.prisma.eventTeamBonus.createMany).mockResolvedValue({ count: 3 })

      await repository.logTeamActionBatch(teamActions)

      expect(mockDatabase.prisma.eventTeamBonus.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ playerId: 100 }),
          expect.objectContaining({ playerId: 101 }),
          expect.objectContaining({ playerId: 102 }),
        ]),
        skipDuplicates: true,
      })
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Batch logged 3 team actions"),
      )
    })

    it("should not call createMany for empty batch", async () => {
      await repository.logTeamActionBatch([])

      expect(mockDatabase.prisma.eventTeamBonus.createMany).not.toHaveBeenCalled()
    })

    it("should use 0 for invalid player IDs in batch", async () => {
      const teamActions = [{ playerId: -5, serverId: 1, actionId: 1, map: "de_dust2", bonus: 2 }]

      vi.mocked(mockDatabase.prisma.eventTeamBonus.createMany).mockResolvedValue({ count: 1 })

      await repository.logTeamActionBatch(teamActions)

      expect(mockDatabase.prisma.eventTeamBonus.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([expect.objectContaining({ playerId: 0 })]),
        skipDuplicates: true,
      })
    })

    it("should throw error on database failure", async () => {
      const teamActions = [{ playerId: 100, serverId: 1, actionId: 1, map: "de_dust2", bonus: 2 }]

      vi.mocked(mockDatabase.prisma.eventTeamBonus.createMany).mockRejectedValue(
        new Error("Database error"),
      )

      await expect(repository.logTeamActionBatch(teamActions)).rejects.toThrow(
        "Failed to batch log team actions",
      )
    })
  })
})
