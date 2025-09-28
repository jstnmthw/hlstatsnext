/**
 * ActionService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { ActionService } from "./action.service"
import { createMockLogger } from "@/tests/mocks/logger"
import type { IActionRepository, ActionDefinition, ActionEvent } from "./action.types"
import type {
  ActionPlayerEvent,
  ActionPlayerPlayerEvent,
  ActionTeamEvent,
  WorldActionEvent,
} from "./action.types"
import { EventType } from "@/shared/types/events"
import type { IPlayerService } from "@/modules/player/types/player.types"
import type { IMatchService } from "@/modules/match/match.types"

// Create mock repository
const createMockActionRepository = (): IActionRepository => ({
  findActionByCode: vi.fn(),
  logPlayerAction: vi.fn(),
  logPlayerPlayerAction: vi.fn(),
  logTeamActionForPlayer: vi.fn(),
  logWorldAction: vi.fn(),
  logTeamActionBatch: vi.fn(),
})

describe("ActionService", () => {
  let actionService: ActionService
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockRepository: IActionRepository
  let mockPlayerService: IPlayerService
  let mockMatchService: IMatchService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockActionRepository()
    mockPlayerService = {
      getPlayerStats: vi.fn().mockResolvedValue({ playerId: 1 }),
      updatePlayerStats: vi.fn().mockResolvedValue(undefined),
      getOrCreatePlayer: vi.fn(),
      getPlayerRating: vi.fn(),
      updatePlayerRatings: vi.fn(),
      handlePlayerEvent: vi.fn(),
      getPlayerStatsBatch: vi.fn().mockResolvedValue(new Map()),
      updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
    }
    mockMatchService = {
      getPlayersByTeam: vi.fn().mockReturnValue([]),
      handleMatchEvent: vi.fn(),
      handleKillInMatch: vi.fn(),
      handleObjectiveAction: vi.fn(),
      getMatchStats: vi.fn(),
      getCurrentMap: vi.fn().mockReturnValue(""),
      initializeMapForServer: vi.fn().mockResolvedValue(""),
      resetMatchStats: vi.fn(),
      updatePlayerWeaponStats: vi.fn(),
      calculateMatchMVP: vi.fn(),
      calculatePlayerScore: vi.fn(),
      setPlayerTeam: vi.fn(),
      getServerGame: vi.fn().mockResolvedValue("cstrike"),
    }
    actionService = new ActionService(
      mockRepository,
      mockLogger,
      mockPlayerService,
      mockMatchService,
    )
  })

  describe("Service instantiation", () => {
    it("should create service instance", () => {
      expect(actionService).toBeDefined()
      expect(actionService).toBeInstanceOf(ActionService)
    })

    it("should have handleActionEvent method", () => {
      expect(actionService.handleActionEvent).toBeDefined()
      expect(typeof actionService.handleActionEvent).toBe("function")
    })
  })

  describe("handleActionEvent", () => {
    it("should resolve SFUI alias to canonical action code for csgo/cs2", async () => {
      const repo = createMockActionRepository()
      const svc = new ActionService(repo, mockLogger)

      const canonicalDef: ActionDefinition = {
        id: 42,
        game: "csgo",
        code: "Target_Bombed",
        rewardPlayer: 0,
        rewardTeam: 5,
        team: "TERRORIST",
        description: "Terrorists bombed the target",
        forPlayerActions: false,
        forPlayerPlayerActions: false,
        forTeamActions: true,
        forWorldActions: false,
      }

      vi.mocked(repo.findActionByCode).mockResolvedValue(canonicalDef)
      vi.mocked(repo.logTeamActionForPlayer).mockResolvedValue()

      const event: ActionTeamEvent = {
        timestamp: new Date(),
        serverId: 7,
        eventType: EventType.ACTION_TEAM,
        data: {
          team: "TERRORIST",
          actionCode: "SFUI_Notice_Target_Bombed",
          game: "csgo",
        },
      }

      const result = await svc.handleActionEvent(event)
      expect(result.success).toBe(true)
      expect(repo.findActionByCode).toHaveBeenCalledWith(
        "csgo",
        "SFUI_Notice_Target_Bombed",
        "TERRORIST",
      )
    })
    it("should handle ACTION_PLAYER events", async () => {
      // Mock action definition
      const mockActionDef: ActionDefinition = {
        id: 1,
        game: "csgo",
        code: "score",
        rewardPlayer: 5,
        rewardTeam: 0,
        team: "ct",
        description: "Score action",
        forPlayerActions: true,
        forPlayerPlayerActions: false,
        forTeamActions: false,
        forWorldActions: false,
      }

      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(mockActionDef)
      vi.mocked(mockRepository.logPlayerAction).mockResolvedValue()

      const playerActionEvent: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: "score",
          game: "csgo",
          team: "ct",
          bonus: 10,
        },
      }

      const result = await actionService.handleActionEvent(playerActionEvent)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(1)
      expect(mockRepository.findActionByCode).toHaveBeenCalledWith("csgo", "score", "ct")
      expect(mockRepository.logPlayerAction).toHaveBeenCalledWith(1, 1, 1, "", 10)
    })

    it("should handle ACTION_PLAYER_PLAYER events", async () => {
      // Mock repository to return null (action not found)
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      const playerPlayerActionEvent: ActionPlayerPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER_PLAYER,
        data: {
          playerId: 1,
          victimId: 2,
          actionCode: "assist",
          game: "csgo",
          team: "ct",
          bonus: 5,
        },
      }

      const result = await actionService.handleActionEvent(playerPlayerActionEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith("Unknown action code: assist for game csgo")
    })

    it("should handle ACTION_TEAM events", async () => {
      // Mock repository to return null (action not found)
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      const teamActionEvent: ActionTeamEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_TEAM,
        data: {
          team: "ct",
          actionCode: "round_win",
          game: "csgo",
          playersAffected: [1, 2, 3],
          bonus: 25,
        },
      }

      const result = await actionService.handleActionEvent(teamActionEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith("Unknown action code: round_win for game csgo")
    })

    it("should award rewardTeam to teammates and log team bonus rows with bonus column set to rewardTeam", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue({
        id: 10,
        game: "cstrike",
        code: "Target_Bombed",
        rewardPlayer: 0,
        rewardTeam: 2,
        team: "TERRORIST",
        description: null,
        forPlayerActions: false,
        forPlayerPlayerActions: false,
        forTeamActions: true,
        forWorldActions: false,
      })
      vi.mocked(mockRepository.logTeamActionForPlayer).mockResolvedValue(undefined)

      const actionEvent: ActionEvent = {
        eventType: EventType.ACTION_TEAM,
        timestamp: new Date(),
        serverId: 42,
        data: {
          team: "TERRORIST",
          actionCode: "Target_Bombed",
          game: "cstrike",
        },
      } as unknown as ActionEvent

      // Mock team roster
      vi.mocked(mockMatchService.getPlayersByTeam).mockReturnValue([1, 2, 0, -1])
      await actionService.handleActionEvent(actionEvent)

      // Team bonus rows persisted as batch; bonus column equals rewardTeam (2)
      expect(mockRepository.logTeamActionBatch).toHaveBeenCalledWith([
        {
          playerId: 1,
          serverId: 42,
          actionId: 10,
          map: expect.any(String),
          bonus: 2,
        },
        {
          playerId: 2,
          serverId: 42,
          actionId: 10,
          map: expect.any(String),
          bonus: 2,
        },
      ])
      // Skill awarded to valid teammates as batch
      expect(mockPlayerService.updatePlayerStatsBatch).toHaveBeenCalledWith([
        { playerId: 1, skillDelta: 2 },
        { playerId: 2, skillDelta: 2 },
      ])
    })

    it("should add extra event bonus to rewardTeam when logging team bonus rows", async () => {
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue({
        id: 11,
        game: "cstrike",
        code: "Objective_Captured",
        rewardPlayer: 0,
        rewardTeam: 3,
        team: "CT",
        description: null,
        forPlayerActions: false,
        forPlayerPlayerActions: false,
        forTeamActions: true,
        forWorldActions: false,
      })
      vi.mocked(mockRepository.logTeamActionForPlayer).mockResolvedValue(undefined)

      const actionEvent: ActionEvent = {
        eventType: EventType.ACTION_TEAM,
        timestamp: new Date(),
        serverId: 100,
        data: {
          team: "CT",
          actionCode: "Objective_Captured",
          game: "cstrike",
          bonus: 4,
        },
      } as unknown as ActionEvent

      vi.mocked(mockMatchService.getPlayersByTeam).mockReturnValue([5, 9])

      await actionService.handleActionEvent(actionEvent)

      // Expect bonus column to contain rewardTeam + bonus = 3 + 4 = 7
      expect(mockRepository.logTeamActionBatch).toHaveBeenCalledWith([
        {
          playerId: 5,
          serverId: 100,
          actionId: 11,
          map: expect.any(String),
          bonus: 7,
        },
        {
          playerId: 9,
          serverId: 100,
          actionId: 11,
          map: expect.any(String),
          bonus: 7,
        },
      ])
      // Skill update uses the same total as batch
      expect(mockPlayerService.updatePlayerStatsBatch).toHaveBeenCalledWith([
        { playerId: 5, skillDelta: 7 },
        { playerId: 9, skillDelta: 7 },
      ])
    })

    it("should handle ACTION_WORLD events", async () => {
      // Mock repository to return null (action not found)
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      const worldActionEvent: WorldActionEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_WORLD,
        data: {
          actionCode: "map_start",
          game: "csgo",
          bonus: 0,
        },
      }

      const result = await actionService.handleActionEvent(worldActionEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith("Unknown action code: map_start for game csgo")
    })

    it("should handle unknown event types gracefully", async () => {
      const unknownEvent: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: "unknown",
          game: "csgo",
        },
      }

      const result = await actionService.handleActionEvent(unknownEvent)

      expect(result.success).toBe(true)
    })

    it("should handle errors and return failure result", async () => {
      // Mock repository to return null (unknown action)
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      // Mock logger to throw an error
      vi.spyOn(mockLogger, "warn").mockImplementation(() => {
        throw new Error("Logger error")
      })

      const playerActionEvent: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: "score",
          game: "csgo",
        },
      }

      const result = await actionService.handleActionEvent(playerActionEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Logger error")
    })
  })

  describe("Action event data validation", () => {
    it("should handle minimal ACTION_PLAYER event data", async () => {
      // Mock repository to return null (action not found)
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      const minimalEvent: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: "basic_action",
          game: "csgo",
        },
      }

      const result = await actionService.handleActionEvent(minimalEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Unknown action code: basic_action for game csgo",
      )
    })

    it("should handle ACTION_TEAM event without players affected", async () => {
      // Mock repository to return null (action not found)
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      const teamEvent: ActionTeamEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_TEAM,
        data: {
          team: "terrorist",
          actionCode: "bomb_plant",
          game: "csgo",
        },
      }

      const result = await actionService.handleActionEvent(teamEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith("Unknown action code: bomb_plant for game csgo")
    })

    it("should handle ACTION_WORLD event with zero bonus", async () => {
      // Mock repository to return null (action not found)
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      const worldEvent: WorldActionEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_WORLD,
        data: {
          actionCode: "round_start",
          game: "csgo",
          bonus: 0,
        },
      }

      const result = await actionService.handleActionEvent(worldEvent)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith("Unknown action code: round_start for game csgo")
    })

    it("should not update player stats when totalPoints is 0", async () => {
      // Mock player service
      const mockPlayerService = {
        getPlayerStats: vi.fn().mockResolvedValue({ playerId: 1 }),
        updatePlayerStats: vi.fn().mockResolvedValue(undefined),
        getOrCreatePlayer: vi.fn().mockResolvedValue(1),
        getPlayerRating: vi.fn().mockResolvedValue({ skill: 1000, uncertainty: 100 }),
        updatePlayerRatings: vi.fn().mockResolvedValue(undefined),
        getTopPlayers: vi.fn().mockResolvedValue([]),
        getRoundParticipants: vi.fn().mockResolvedValue([]),
        handlePlayerEvent: vi.fn().mockResolvedValue({ success: true }),
        getPlayerStatsBatch: vi.fn().mockResolvedValue(new Map()),
        updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
      }

      // Create service with player service
      const serviceWithPlayerService = new ActionService(
        mockRepository,
        mockLogger,
        mockPlayerService,
      )

      // Mock action definition with 0 reward
      const mockActionDef: ActionDefinition = {
        id: 1,
        game: "csgo",
        code: "no_reward_action",
        rewardPlayer: 0, // Zero reward
        rewardTeam: 0,
        team: "ct",
        description: "Action with no reward",
        forPlayerActions: true,
        forPlayerPlayerActions: false,
        forTeamActions: false,
        forWorldActions: false,
      }

      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(mockActionDef)
      vi.mocked(mockRepository.logPlayerAction).mockResolvedValue()

      const playerActionEvent: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: "no_reward_action",
          game: "csgo",
          team: "ct",
          bonus: 0, // Zero bonus
        },
      }

      const result = await serviceWithPlayerService.handleActionEvent(playerActionEvent)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(1)
      expect(mockRepository.logPlayerAction).toHaveBeenCalledWith(1, 1, 1, "", 0)
      expect(mockPlayerService.updatePlayerStats).not.toHaveBeenCalled() // Should NOT be called when totalPoints is 0
    })
  })

  describe("Error handling edge cases", () => {
    it("should handle non-Error exceptions", async () => {
      // Mock repository to return null (unknown action)
      vi.mocked(mockRepository.findActionByCode).mockResolvedValue(null)

      vi.spyOn(mockLogger, "warn").mockImplementation(() => {
        throw "String error"
      })

      const event: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: "test",
          game: "csgo",
        },
      }

      const result = await actionService.handleActionEvent(event)

      expect(result.success).toBe(false)
      expect(result.error).toBe("String error")
    })
  })
})
