/**
 * ActionService Unit Tests
 */

import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerService } from "@/modules/player/types/player.types"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ActionService } from "./action.service"
import type {
  ActionDefinition,
  ActionEvent,
  ActionPlayerEvent,
  ActionPlayerPlayerEvent,
  ActionTeamEvent,
  IActionRepository,
  WorldActionEvent,
} from "./action.types"

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
      getMatchStats: vi.fn(),
      getServerGame: vi.fn().mockResolvedValue("cstrike"),
      resetMatchStats: vi.fn(),
      setPlayerTeam: vi.fn(),
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

  describe("handlePlayerAction with eventNotificationService", () => {
    const mockEventNotificationService = {
      notifyActionEvent: vi.fn().mockResolvedValue(undefined),
      notifyTeamActionEvent: vi.fn().mockResolvedValue(undefined),
      notifyKillEvent: vi.fn().mockResolvedValue(undefined),
      notifySuicideEvent: vi.fn().mockResolvedValue(undefined),
      notifyTeamKillEvent: vi.fn().mockResolvedValue(undefined),
      notifyConnectEvent: vi.fn().mockResolvedValue(undefined),
      notifyDisconnectEvent: vi.fn().mockResolvedValue(undefined),
      isEventTypeEnabled: vi.fn().mockResolvedValue(true),
    }

    const validActionDef: ActionDefinition = {
      id: 5,
      game: "csgo",
      code: "objective",
      rewardPlayer: 10,
      rewardTeam: 0,
      team: "ct",
      description: "Objective action",
      forPlayerActions: true,
      forPlayerPlayerActions: false,
      forTeamActions: false,
      forWorldActions: false,
    }

    beforeEach(() => {
      vi.clearAllMocks()
      mockEventNotificationService.notifyActionEvent.mockResolvedValue(undefined)
      mockEventNotificationService.notifyTeamActionEvent.mockResolvedValue(undefined)
    })

    it("should call notifyActionEvent when totalPoints !== 0 and eventNotificationService is provided", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const playerSvc = {
        getPlayerStats: vi.fn().mockResolvedValue({ skill: 1500, lastName: "TestPlayer" }),
        updatePlayerStats: vi.fn().mockResolvedValue(undefined),
        getOrCreatePlayer: vi.fn(),
        getPlayerRating: vi.fn(),
        updatePlayerRatings: vi.fn(),
        handlePlayerEvent: vi.fn(),
        getPlayerStatsBatch: vi.fn().mockResolvedValue(new Map([[1, { skill: 1500 }]])),
        updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
      }

      const svc = new ActionService(
        repo,
        logger,
        playerSvc as unknown as typeof playerSvc,
        undefined,
        mockEventNotificationService,
      )

      vi.mocked(repo.findActionByCode).mockResolvedValue(validActionDef)
      vi.mocked(repo.logPlayerAction).mockResolvedValue()

      const event: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 3,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: "objective",
          game: "csgo",
          team: "ct",
          bonus: 5,
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(mockEventNotificationService.notifyActionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 3,
          playerId: 1,
          playerSkill: 1500,
          playerName: "TestPlayer",
          actionCode: "objective",
          points: 15, // rewardPlayer(10) + bonus(5)
        }),
      )
    })

    it("should fallback to playerSkill=1000 when getPlayerStats throws during notification", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const playerSvc = {
        // First call succeeds (validateSinglePlayer), second call throws (notification block)
        getPlayerStats: vi
          .fn()
          .mockResolvedValueOnce({ skill: 1000, lastName: "Player" })
          .mockRejectedValue(new Error("DB error")),
        updatePlayerStats: vi.fn().mockResolvedValue(undefined),
        getOrCreatePlayer: vi.fn(),
        getPlayerRating: vi.fn(),
        updatePlayerRatings: vi.fn(),
        handlePlayerEvent: vi.fn(),
        getPlayerStatsBatch: vi.fn().mockResolvedValue(new Map([[1, {}]])),
        updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
      }

      const svc = new ActionService(
        repo,
        logger,
        playerSvc as unknown as typeof playerSvc,
        undefined,
        mockEventNotificationService,
      )

      vi.mocked(repo.findActionByCode).mockResolvedValue(validActionDef)
      vi.mocked(repo.logPlayerAction).mockResolvedValue()

      const event: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 3,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: "objective",
          game: "csgo",
          team: "ct",
          bonus: 0,
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(mockEventNotificationService.notifyActionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          playerSkill: 1000,
        }),
      )
    })

    it("should log warn but not fail when notifyActionEvent throws", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const playerSvc = {
        getPlayerStats: vi.fn().mockResolvedValue({ skill: 1000, lastName: "Player" }),
        updatePlayerStats: vi.fn().mockResolvedValue(undefined),
        getOrCreatePlayer: vi.fn(),
        getPlayerRating: vi.fn(),
        updatePlayerRatings: vi.fn(),
        handlePlayerEvent: vi.fn(),
        getPlayerStatsBatch: vi.fn().mockResolvedValue(new Map([[1, {}]])),
        updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
      }

      const failingNotificationService = {
        ...mockEventNotificationService,
        notifyActionEvent: vi.fn().mockRejectedValue(new Error("Notification failed")),
      }

      const svc = new ActionService(
        repo,
        logger,
        playerSvc as unknown as typeof playerSvc,
        undefined,
        failingNotificationService,
      )

      vi.mocked(repo.findActionByCode).mockResolvedValue(validActionDef)
      vi.mocked(repo.logPlayerAction).mockResolvedValue()

      const event: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 3,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: "objective",
          game: "csgo",
          team: "ct",
          bonus: 0,
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to send action notification",
        expect.objectContaining({ actionCode: "objective" }),
      )
    })

    it("should NOT call notifyActionEvent when totalPoints === 0", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()

      const zeroRewardActionDef: ActionDefinition = {
        ...validActionDef,
        rewardPlayer: 0,
      }

      const svc = new ActionService(
        repo,
        logger,
        undefined,
        undefined,
        mockEventNotificationService,
      )

      vi.mocked(repo.findActionByCode).mockResolvedValue(zeroRewardActionDef)
      vi.mocked(repo.logPlayerAction).mockResolvedValue()

      const event: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 3,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: "objective",
          game: "csgo",
          team: "ct",
          bonus: 0,
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(mockEventNotificationService.notifyActionEvent).not.toHaveBeenCalled()
    })
  })

  describe("handlePlayerAction with mapService", () => {
    const mockMapService = {
      getCurrentMap: vi.fn().mockResolvedValue("de_dust2"),
      handleMapChange: vi.fn(),
      getLastKnownMap: vi.fn().mockResolvedValue(null),
    }

    beforeEach(() => {
      vi.clearAllMocks()
      mockMapService.getCurrentMap.mockResolvedValue("de_dust2")
    })

    it("should call getCurrentMap and pass map to logPlayerAction when mapService is available", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()

      const actionDef: ActionDefinition = {
        id: 7,
        game: "csgo",
        code: "plant",
        rewardPlayer: 3,
        rewardTeam: 0,
        team: "TERRORIST",
        description: null,
        forPlayerActions: true,
        forPlayerPlayerActions: false,
        forTeamActions: false,
        forWorldActions: false,
      }

      const svc = new ActionService(repo, logger, undefined, undefined, undefined, mockMapService)

      vi.mocked(repo.findActionByCode).mockResolvedValue(actionDef)
      vi.mocked(repo.logPlayerAction).mockResolvedValue()

      const event: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 5,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 2,
          actionCode: "plant",
          game: "csgo",
          team: "TERRORIST",
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(mockMapService.getCurrentMap).toHaveBeenCalledWith(5)
      expect(repo.logPlayerAction).toHaveBeenCalledWith(2, 7, 5, "de_dust2", 0)
    })

    it("should use empty string for map when mapService is not available", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()

      const actionDef: ActionDefinition = {
        id: 7,
        game: "csgo",
        code: "plant",
        rewardPlayer: 3,
        rewardTeam: 0,
        team: "TERRORIST",
        description: null,
        forPlayerActions: true,
        forPlayerPlayerActions: false,
        forTeamActions: false,
        forWorldActions: false,
      }

      // No mapService provided
      const svc = new ActionService(repo, logger, undefined, undefined, undefined, undefined)

      vi.mocked(repo.findActionByCode).mockResolvedValue(actionDef)
      vi.mocked(repo.logPlayerAction).mockResolvedValue()

      const event: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 5,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 2,
          actionCode: "plant",
          game: "csgo",
          team: "TERRORIST",
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(repo.logPlayerAction).toHaveBeenCalledWith(2, 7, 5, "", 0)
    })
  })

  describe("handlePlayerPlayerAction with valid action", () => {
    const validPlayerPlayerActionDef: ActionDefinition = {
      id: 20,
      game: "csgo",
      code: "assist",
      rewardPlayer: 4,
      rewardTeam: 0,
      team: "ct",
      description: "Assist action",
      forPlayerActions: false,
      forPlayerPlayerActions: true,
      forTeamActions: false,
      forWorldActions: false,
    }

    it("should call logPlayerPlayerAction and updatePlayerStats for a valid action with totalPoints !== 0", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const playerSvc = {
        getPlayerStats: vi.fn().mockResolvedValue({ skill: 1000 }),
        updatePlayerStats: vi.fn().mockResolvedValue(undefined),
        getOrCreatePlayer: vi.fn(),
        getPlayerRating: vi.fn(),
        updatePlayerRatings: vi.fn(),
        handlePlayerEvent: vi.fn(),
        getPlayerStatsBatch: vi.fn().mockResolvedValue(
          new Map([
            [1, {}],
            [2, {}],
          ]),
        ),
        updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
      }

      const svc = new ActionService(repo, logger, playerSvc as unknown as typeof playerSvc)

      vi.mocked(repo.findActionByCode).mockResolvedValue(validPlayerPlayerActionDef)
      vi.mocked(repo.logPlayerPlayerAction).mockResolvedValue()

      const event: ActionPlayerPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER_PLAYER,
        data: {
          playerId: 1,
          victimId: 2,
          actionCode: "assist",
          game: "csgo",
          team: "ct",
          bonus: 1,
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(1)
      expect(repo.logPlayerPlayerAction).toHaveBeenCalledWith(1, 2, 20, 1, "", 1)
      expect(playerSvc.updatePlayerStats).toHaveBeenCalledWith(1, { skill: 5 }) // rewardPlayer(4) + bonus(1)
    })

    it("should NOT call updatePlayerStats when totalPoints === 0", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const playerSvc = {
        getPlayerStats: vi.fn().mockResolvedValue({ skill: 1000 }),
        updatePlayerStats: vi.fn().mockResolvedValue(undefined),
        getOrCreatePlayer: vi.fn(),
        getPlayerRating: vi.fn(),
        updatePlayerRatings: vi.fn(),
        handlePlayerEvent: vi.fn(),
        getPlayerStatsBatch: vi.fn().mockResolvedValue(
          new Map([
            [1, {}],
            [2, {}],
          ]),
        ),
        updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
      }

      const zeroRewardDef: ActionDefinition = {
        ...validPlayerPlayerActionDef,
        rewardPlayer: 0,
      }

      const svc = new ActionService(repo, logger, playerSvc as unknown as typeof playerSvc)

      vi.mocked(repo.findActionByCode).mockResolvedValue(zeroRewardDef)
      vi.mocked(repo.logPlayerPlayerAction).mockResolvedValue()

      const event: ActionPlayerPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER_PLAYER,
        data: {
          playerId: 1,
          victimId: 2,
          actionCode: "assist",
          game: "csgo",
          team: "ct",
          bonus: 0,
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(1)
      expect(repo.logPlayerPlayerAction).toHaveBeenCalled()
      expect(playerSvc.updatePlayerStats).not.toHaveBeenCalled()
    })

    it("should return early when player is not found in validatePlayerPair", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const playerSvc = {
        getPlayerStats: vi.fn().mockResolvedValue({ skill: 1000 }),
        updatePlayerStats: vi.fn().mockResolvedValue(undefined),
        getOrCreatePlayer: vi.fn(),
        getPlayerRating: vi.fn(),
        updatePlayerRatings: vi.fn(),
        handlePlayerEvent: vi.fn(),
        // Player 1 not found, only victim 2 exists
        getPlayerStatsBatch: vi.fn().mockResolvedValue(new Map([[2, {}]])),
        updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
      }

      const svc = new ActionService(repo, logger, playerSvc as unknown as typeof playerSvc)

      vi.mocked(repo.findActionByCode).mockResolvedValue(validPlayerPlayerActionDef)
      vi.mocked(repo.logPlayerPlayerAction).mockResolvedValue()

      const event: ActionPlayerPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER_PLAYER,
        data: {
          playerId: 1,
          victimId: 2,
          actionCode: "assist",
          game: "csgo",
          team: "ct",
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(repo.logPlayerPlayerAction).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith("Player 1 not found, skipping action: assist")
    })

    it("should return early when victim is not found in validatePlayerPair", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const playerSvc = {
        getPlayerStats: vi.fn().mockResolvedValue({ skill: 1000 }),
        updatePlayerStats: vi.fn().mockResolvedValue(undefined),
        getOrCreatePlayer: vi.fn(),
        getPlayerRating: vi.fn(),
        updatePlayerRatings: vi.fn(),
        handlePlayerEvent: vi.fn(),
        // Only player 1 found, victim 2 not found
        getPlayerStatsBatch: vi.fn().mockResolvedValue(new Map([[1, {}]])),
        updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
      }

      const svc = new ActionService(repo, logger, playerSvc as unknown as typeof playerSvc)

      vi.mocked(repo.findActionByCode).mockResolvedValue(validPlayerPlayerActionDef)
      vi.mocked(repo.logPlayerPlayerAction).mockResolvedValue()

      const event: ActionPlayerPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER_PLAYER,
        data: {
          playerId: 1,
          victimId: 2,
          actionCode: "assist",
          game: "csgo",
          team: "ct",
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(repo.logPlayerPlayerAction).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith("Victim 2 not found, skipping action: assist")
    })
  })

  describe("handleTeamAction with eventNotificationService", () => {
    const mockEventNotificationService = {
      notifyActionEvent: vi.fn().mockResolvedValue(undefined),
      notifyTeamActionEvent: vi.fn().mockResolvedValue(undefined),
      notifyKillEvent: vi.fn().mockResolvedValue(undefined),
      notifySuicideEvent: vi.fn().mockResolvedValue(undefined),
      notifyTeamKillEvent: vi.fn().mockResolvedValue(undefined),
      notifyConnectEvent: vi.fn().mockResolvedValue(undefined),
      notifyDisconnectEvent: vi.fn().mockResolvedValue(undefined),
      isEventTypeEnabled: vi.fn().mockResolvedValue(true),
    }

    const teamActionDef: ActionDefinition = {
      id: 30,
      game: "cstrike",
      code: "Round_Win",
      rewardPlayer: 0,
      rewardTeam: 5,
      team: "CT",
      description: "Round win",
      forPlayerActions: false,
      forPlayerPlayerActions: false,
      forTeamActions: true,
      forWorldActions: false,
    }

    beforeEach(() => {
      vi.clearAllMocks()
      mockEventNotificationService.notifyTeamActionEvent.mockResolvedValue(undefined)
    })

    it("should call notifyTeamActionEvent when totalPoints !== 0 and service is provided", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const matchSvc = {
        getPlayersByTeam: vi.fn().mockReturnValue([]),
        handleMatchEvent: vi.fn(),
        getMatchStats: vi.fn(),
        getServerGame: vi.fn().mockResolvedValue("cstrike"),
        resetMatchStats: vi.fn(),
        setPlayerTeam: vi.fn(),
      }

      const svc = new ActionService(repo, logger, undefined, matchSvc, mockEventNotificationService)

      vi.mocked(repo.findActionByCode).mockResolvedValue(teamActionDef)

      const event: ActionTeamEvent = {
        timestamp: new Date(),
        serverId: 8,
        eventType: EventType.ACTION_TEAM,
        data: {
          team: "CT",
          actionCode: "Round_Win",
          game: "cstrike",
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(mockEventNotificationService.notifyTeamActionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 8,
          team: "CT",
          actionCode: "Round_Win",
          points: 5, // rewardTeam(5) + no bonus
        }),
      )
    })

    it("should log warn but not fail when notifyTeamActionEvent throws", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()

      const failingNotificationService = {
        ...mockEventNotificationService,
        notifyTeamActionEvent: vi.fn().mockRejectedValue(new Error("Team notify failed")),
      }

      const svc = new ActionService(repo, logger, undefined, undefined, failingNotificationService)

      vi.mocked(repo.findActionByCode).mockResolvedValue(teamActionDef)

      const event: ActionTeamEvent = {
        timestamp: new Date(),
        serverId: 8,
        eventType: EventType.ACTION_TEAM,
        data: {
          team: "CT",
          actionCode: "Round_Win",
          game: "cstrike",
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to send team action notification",
        expect.objectContaining({ actionCode: "Round_Win", team: "CT" }),
      )
    })

    it("should NOT call notifyTeamActionEvent when totalPoints === 0", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()

      const zeroRewardTeamDef: ActionDefinition = {
        ...teamActionDef,
        rewardTeam: 0,
      }

      const svc = new ActionService(
        repo,
        logger,
        undefined,
        undefined,
        mockEventNotificationService,
      )

      vi.mocked(repo.findActionByCode).mockResolvedValue(zeroRewardTeamDef)

      const event: ActionTeamEvent = {
        timestamp: new Date(),
        serverId: 8,
        eventType: EventType.ACTION_TEAM,
        data: {
          team: "CT",
          actionCode: "Round_Win",
          game: "cstrike",
          bonus: 0,
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(mockEventNotificationService.notifyTeamActionEvent).not.toHaveBeenCalled()
    })
  })

  describe("handleTeamAction with rewardTeam === 0", () => {
    it("should NOT call updatePlayerStatsBatch when rewardTeam === 0 even if players exist", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const playerSvc = {
        getPlayerStats: vi.fn().mockResolvedValue(null),
        updatePlayerStats: vi.fn().mockResolvedValue(undefined),
        getOrCreatePlayer: vi.fn(),
        getPlayerRating: vi.fn(),
        updatePlayerRatings: vi.fn(),
        handlePlayerEvent: vi.fn(),
        getPlayerStatsBatch: vi.fn().mockResolvedValue(new Map()),
        updatePlayerStatsBatch: vi.fn().mockResolvedValue(undefined),
      }
      const matchSvc = {
        getPlayersByTeam: vi.fn().mockReturnValue([10, 11, 12]),
        handleMatchEvent: vi.fn(),
        getMatchStats: vi.fn(),
        getServerGame: vi.fn().mockResolvedValue("cstrike"),
        resetMatchStats: vi.fn(),
        setPlayerTeam: vi.fn(),
      }

      const zeroRewardTeamDef: ActionDefinition = {
        id: 31,
        game: "cstrike",
        code: "Round_Draw",
        rewardPlayer: 0,
        rewardTeam: 0, // Zero team reward
        team: "ALL",
        description: "Round draw",
        forPlayerActions: false,
        forPlayerPlayerActions: false,
        forTeamActions: true,
        forWorldActions: false,
      }

      const svc = new ActionService(
        repo,
        logger,
        playerSvc as unknown as typeof playerSvc,
        matchSvc,
      )

      vi.mocked(repo.findActionByCode).mockResolvedValue(zeroRewardTeamDef)
      vi.mocked(repo.logTeamActionBatch).mockResolvedValue()

      const event: ActionTeamEvent = {
        timestamp: new Date(),
        serverId: 9,
        eventType: EventType.ACTION_TEAM,
        data: {
          team: "ALL",
          actionCode: "Round_Draw",
          game: "cstrike",
          bonus: 0,
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      // logTeamActionBatch should still be called (bonus=0 per player)
      expect(repo.logTeamActionBatch).toHaveBeenCalled()
      // But updatePlayerStatsBatch should NOT be called when rewardTeam === 0
      expect(playerSvc.updatePlayerStatsBatch).not.toHaveBeenCalled()
    })
  })

  describe("handleTeamAction without matchService", () => {
    it("should skip player enumeration and still succeed when matchService is not provided", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()

      const teamActionDef: ActionDefinition = {
        id: 32,
        game: "cstrike",
        code: "Bomb_Explode",
        rewardPlayer: 0,
        rewardTeam: 3,
        team: "TERRORIST",
        description: null,
        forPlayerActions: false,
        forPlayerPlayerActions: false,
        forTeamActions: true,
        forWorldActions: false,
      }

      // No matchService
      const svc = new ActionService(repo, logger, undefined, undefined)

      vi.mocked(repo.findActionByCode).mockResolvedValue(teamActionDef)

      const event: ActionTeamEvent = {
        timestamp: new Date(),
        serverId: 10,
        eventType: EventType.ACTION_TEAM,
        data: {
          team: "TERRORIST",
          actionCode: "Bomb_Explode",
          game: "cstrike",
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(1)
      // No team players processed since matchService is absent
      expect(repo.logTeamActionBatch).not.toHaveBeenCalled()
    })
  })

  describe("handleWorldAction with valid action", () => {
    const worldActionDef: ActionDefinition = {
      id: 40,
      game: "csgo",
      code: "Map_Start",
      rewardPlayer: 0,
      rewardTeam: 0,
      team: "",
      description: "Map started",
      forPlayerActions: false,
      forPlayerPlayerActions: false,
      forTeamActions: false,
      forWorldActions: true,
    }

    it("should call logWorldAction when a valid world action is found", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const svc = new ActionService(repo, logger)

      vi.mocked(repo.findActionByCode).mockResolvedValue(worldActionDef)
      vi.mocked(repo.logWorldAction).mockResolvedValue()

      const event: WorldActionEvent = {
        timestamp: new Date(),
        serverId: 2,
        eventType: EventType.ACTION_WORLD,
        data: {
          actionCode: "Map_Start",
          game: "csgo",
          bonus: 0,
        },
      }

      const result = await svc.handleActionEvent(event)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(1)
      expect(repo.logWorldAction).toHaveBeenCalledWith(2, 40, "", 0)
    })

    it("should include points in debug log when bonus is nonzero", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const svc = new ActionService(repo, logger)

      vi.mocked(repo.findActionByCode).mockResolvedValue(worldActionDef)
      vi.mocked(repo.logWorldAction).mockResolvedValue()

      const event: WorldActionEvent = {
        timestamp: new Date(),
        serverId: 2,
        eventType: EventType.ACTION_WORLD,
        data: {
          actionCode: "Map_Start",
          game: "csgo",
          bonus: 7,
        },
      }

      await svc.handleActionEvent(event)

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("+7 points"))
    })

    it("should use getCurrentMap from mapService when available for world actions", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const mapSvc = {
        getCurrentMap: vi.fn().mockResolvedValue("de_inferno"),
        handleMapChange: vi.fn(),
        getLastKnownMap: vi.fn().mockResolvedValue(null),
      }

      const svc = new ActionService(repo, logger, undefined, undefined, undefined, mapSvc)

      vi.mocked(repo.findActionByCode).mockResolvedValue(worldActionDef)
      vi.mocked(repo.logWorldAction).mockResolvedValue()

      const event: WorldActionEvent = {
        timestamp: new Date(),
        serverId: 2,
        eventType: EventType.ACTION_WORLD,
        data: {
          actionCode: "Map_Start",
          game: "csgo",
          bonus: 0,
        },
      }

      await svc.handleActionEvent(event)

      expect(mapSvc.getCurrentMap).toHaveBeenCalledWith(2)
      expect(repo.logWorldAction).toHaveBeenCalledWith(2, 40, "de_inferno", 0)
    })
  })

  describe("handleActionEvent with truly unknown eventType", () => {
    it("should return { success: true } for an eventType not matching any case", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const svc = new ActionService(repo, logger)

      // Cast to ActionEvent to simulate an unknown/future event type at runtime
      const unknownEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: "UNKNOWN_FUTURE_TYPE",
        data: {},
      } as unknown as ActionPlayerEvent

      const result = await svc.handleActionEvent(unknownEvent)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe("handleActionEvent outer catch", () => {
    it("should return failure result when an error bypasses inner catches", async () => {
      const repo = createMockActionRepository()
      const logger = createMockLogger()
      const svc = new ActionService(repo, logger)

      // Make findActionByCode throw to trigger errors in the inner handlers,
      // but spy on the switch dispatch itself by providing a bad event type
      // that causes the outer switch to throw synchronously before any inner try
      vi.mocked(repo.findActionByCode).mockImplementation(() => {
        throw new Error("Unexpected repository failure")
      })

      const event: ActionPlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ACTION_PLAYER,
        data: {
          playerId: 1,
          actionCode: "score",
          game: "csgo",
        },
      }

      // The inner handler catches and returns failure, outer catch is transparent.
      // To truly hit the outer catch we need to make the switch dispatch throw.
      // We mock the repository's method to throw before any inner try-catch wraps it.
      // Since the inner handlePlayerAction has its own try-catch, let's test that the
      // outer catch handles errors thrown synchronously before the switch (edge case):
      // Simulate by making handleActionEvent receive an event where toString throws.
      const badEvent = new Proxy(event, {
        get(target, prop) {
          if (prop === "eventType") throw new Error("eventType access error")
          return (target as unknown as Record<string | symbol, unknown>)[prop as string]
        },
      }) as unknown as ActionPlayerEvent

      const result = await svc.handleActionEvent(badEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("eventType access error")
    })
  })
})
