import { describe, it, expect, vi, beforeEach } from "vitest"
import { EventProcessorService } from "../../src/services/processor/processor.service"
import { EventType, PlayerKillEvent, PlayerConnectEvent } from "../../src/types/common/events"
import { createMockLogger } from "../types/test-mocks"
import type { IEventService } from "../../src/services/event/event.types"
import type { IPlayerService } from "../../src/services/player/player.types"
import type { IMatchHandler } from "../../src/services/processor/handlers/match.handler.types"
import type { IPlayerHandler } from "../../src/services/processor/handlers/player.handler.types"
import type { IRankingHandler } from "../../src/services/processor/handlers/ranking.handler.types"
import type { IWeaponHandler } from "../../src/services/processor/handlers/weapon.handler.types"
import type { IActionHandler } from "../../src/services/processor/handlers/action.handler.types"
import type { ILogger } from "../../src/utils/logger.types"

// Mock Factories for all dependencies
const createEventServiceMock = (): IEventService => ({ createGameEvent: vi.fn() })
const createPlayerServiceMock = (): IPlayerService => ({
  getOrCreatePlayer: vi.fn().mockResolvedValue(1),
  getPlayerStats: vi.fn(),
  updatePlayerStats: vi.fn(),
  getPlayerRating: vi.fn(),
  updatePlayerRatings: vi.fn(),
  getRoundParticipants: vi.fn(),
  getTopPlayers: vi.fn(),
})
const createMatchHandlerMock = (): IMatchHandler => ({
  handleEvent: vi.fn(),
  getMatchStats: vi.fn(),
})
const createPlayerHandlerMock = (): IPlayerHandler => ({ handleEvent: vi.fn() })
const createRankingHandlerMock = (): IRankingHandler => ({
  handleEvent: vi.fn(),
  calculateExpectedScore: vi.fn(),
  updatePlayerRating: vi.fn(),
})
const createWeaponHandlerMock = (): IWeaponHandler => ({ handleEvent: vi.fn() })
const createActionHandlerMock = (): IActionHandler => ({ handleEvent: vi.fn() })

describe("EventProcessorService", () => {
  let processor: EventProcessorService
  let mockEventService: IEventService
  let mockPlayerService: IPlayerService
  let mockMatchHandler: IMatchHandler
  let mockPlayerHandler: IPlayerHandler
  let mockRankingHandler: IRankingHandler
  let mockWeaponHandler: IWeaponHandler
  let mockActionHandler: IActionHandler
  let mockLogger: ILogger

  beforeEach(() => {
    vi.clearAllMocks()
    mockEventService = createEventServiceMock()
    mockPlayerService = createPlayerServiceMock()
    mockMatchHandler = createMatchHandlerMock()
    mockPlayerHandler = createPlayerHandlerMock()
    mockRankingHandler = createRankingHandlerMock()
    mockWeaponHandler = createWeaponHandlerMock()
    mockActionHandler = createActionHandlerMock()
    mockLogger = createMockLogger()

    processor = new EventProcessorService(
      mockEventService,
      mockPlayerService,
      mockPlayerHandler,
      mockWeaponHandler,
      mockActionHandler,
      mockMatchHandler,
      mockRankingHandler,
      mockLogger,
    )
  })

  describe("processEvent", () => {
    const mockKillEvent: PlayerKillEvent = {
      eventType: EventType.PLAYER_KILL,
      serverId: 1,
      timestamp: new Date(),
      data: {
        killerId: 1,
        victimId: 2,
        weapon: "ak47",
        headshot: false,
        killerTeam: "TERRORIST",
        victimTeam: "CT",
      },
      meta: {
        killer: { steamId: "STEAM_1:0:111", playerName: "Killer", isBot: false },
        victim: { steamId: "STEAM_1:0:222", playerName: "Victim", isBot: false },
      },
    }

    it("should resolve player IDs before processing", async () => {
      await processor.processEvent(mockKillEvent)
      expect(mockPlayerService.getOrCreatePlayer).toHaveBeenCalledTimes(2)
      expect(mockPlayerService.getOrCreatePlayer).toHaveBeenCalledWith(
        "STEAM_1:0:111",
        "Killer",
        "csgo",
      )
      expect(mockPlayerService.getOrCreatePlayer).toHaveBeenCalledWith(
        "STEAM_1:0:222",
        "Victim",
        "csgo",
      )
    })

    it("should persist the event via EventService", async () => {
      await processor.processEvent(mockKillEvent)
      expect(mockEventService.createGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: EventType.PLAYER_KILL }),
      )
    })

    it("should route PLAYER_KILL to correct handlers", async () => {
      await processor.processEvent(mockKillEvent)
      expect(mockPlayerHandler.handleEvent).toHaveBeenCalledWith(mockKillEvent)
      expect(mockWeaponHandler.handleEvent).toHaveBeenCalledWith(mockKillEvent)
      expect(mockRankingHandler.handleEvent).toHaveBeenCalledWith(mockKillEvent)
      expect(mockMatchHandler.handleEvent).not.toHaveBeenCalled()
    })

    it("should route ACTION_PLAYER to ActionHandler", async () => {
      const actionPlayerEvent: import("../../src/types/common/events").ActionPlayerEvent = {
        eventType: EventType.ACTION_PLAYER,
        serverId: 1,
        timestamp: new Date(),
        data: {
          playerId: 0,
          actionCode: "Defused_The_Bomb",
          game: "csgo",
          team: "CT",
        },
        meta: {
          steamId: "STEAM_1:0:333",
          playerName: "Defuser",
          isBot: false,
        },
      }

      await processor.processEvent(actionPlayerEvent)
      expect(mockActionHandler.handleEvent).toHaveBeenCalledWith(actionPlayerEvent)
      expect(mockPlayerService.getOrCreatePlayer).toHaveBeenCalledWith(
        "STEAM_1:0:333",
        "Defuser",
        "csgo",
      )
    })

    it("should route ACTION_TEAM to ActionHandler", async () => {
      const actionTeamEvent: import("../../src/types/common/events").ActionTeamEvent = {
        eventType: EventType.ACTION_TEAM,
        serverId: 1,
        timestamp: new Date(),
        data: {
          team: "CT",
          actionCode: "Bomb_Defused",
          game: "csgo",
        },
      }

      await processor.processEvent(actionTeamEvent)
      expect(mockActionHandler.handleEvent).toHaveBeenCalledWith(actionTeamEvent)
    })

    it("should route ACTION_WORLD to ActionHandler", async () => {
      const worldEvent: import("../../src/types/common/events").WorldActionEvent = {
        eventType: EventType.ACTION_WORLD,
        serverId: 1,
        timestamp: new Date(),
        data: {
          actionCode: "Round_End",
          game: "csgo",
        },
      }

      await processor.processEvent(worldEvent)
      expect(mockActionHandler.handleEvent).toHaveBeenCalledWith(worldEvent)
    })

    it("should throw and log if player resolution fails", async () => {
      const dbError = new Error("DB Error")
      vi.mocked(mockPlayerService.getOrCreatePlayer).mockRejectedValue(dbError)
      await expect(processor.processEvent(mockKillEvent)).rejects.toThrow(dbError)
      expect(mockLogger.failed).toHaveBeenCalledWith("Failed to process event", "DB Error")
    })

    it("should not process bot events if logBots is false", async () => {
      processor = new EventProcessorService(
        mockEventService,
        mockPlayerService,
        mockPlayerHandler,
        mockWeaponHandler,
        mockActionHandler,
        mockMatchHandler,
        mockRankingHandler,
        mockLogger,
        { logBots: false },
      )
      const botEvent: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        meta: { steamId: "BOT", playerName: "BotPlayer", isBot: true },
        data: { playerId: 0, steamId: "BOT", playerName: "BotPlayer", ipAddress: "0.0.0.0" },
      }
      await processor.processEvent(botEvent)
      expect(mockPlayerService.getOrCreatePlayer).not.toHaveBeenCalled()
      expect(mockEventService.createGameEvent).not.toHaveBeenCalled()
      expect(mockLogger.debug).toHaveBeenCalledWith("Skipping bot event: PLAYER_CONNECT")
    })
  })
})
