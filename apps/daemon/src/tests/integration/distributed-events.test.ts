/**
 * Distributed Event Processing Integration Tests
 * 
 * Tests that ensure the migration from centralized to distributed
 * event processing maintains system integrity
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { EventBus } from "@/shared/infrastructure/event-bus/event-bus"
import { EventProcessor } from "@/shared/infrastructure/event-processor"
import { PlayerEventHandler } from "@/modules/player/player.events"
import { WeaponEventHandler } from "@/modules/weapon/weapon.events"
import { MatchEventHandler } from "@/modules/match/match.events"
import { KillEventCoordinator } from "@/shared/application/event-coordinator"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerService } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IWeaponService } from "@/modules/weapon/weapon.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IActionService } from "@/modules/action/action.types"
import type { IServerService } from "@/modules/server/server.types"
import { EventType } from "@/shared/types/events"
import type { BaseEvent, PlayerMeta, DualPlayerMeta } from "@/shared/types/events"

describe("Distributed Event Processing", () => {
  let eventBus: EventBus
  let logger: ILogger
  let playerService: IPlayerService
  let matchService: IMatchService
  let weaponService: IWeaponService
  let rankingService: IRankingService
  let actionService: IActionService
  let serverService: IServerService
  let eventProcessor: EventProcessor
  let playerEventHandler: PlayerEventHandler
  let weaponEventHandler: WeaponEventHandler
  let matchEventHandler: MatchEventHandler

  beforeEach(() => {
    // Create mocks
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger

    playerService = {
      handlePlayerEvent: vi.fn(),
      handleKillEvent: vi.fn(),
      getOrCreatePlayer: vi.fn().mockResolvedValue(123),
    } as unknown as IPlayerService

    matchService = {
      handleMatchEvent: vi.fn(),
      handleObjectiveEvent: vi.fn(),
      handleKillInMatch: vi.fn(),
    } as unknown as IMatchService

    weaponService = {
      handleWeaponEvent: vi.fn(),
    } as unknown as IWeaponService

    rankingService = {
      handleRatingUpdate: vi.fn(),
    } as unknown as IRankingService

    actionService = {
      handleActionEvent: vi.fn(),
    } as unknown as IActionService

    serverService = {
      getServerGame: vi.fn().mockResolvedValue("csgo"),
    } as unknown as IServerService

    // Create event bus
    eventBus = new EventBus(logger)

    // Create event coordinators
    const killEventCoordinator = new KillEventCoordinator(logger, rankingService)
    const coordinators = [killEventCoordinator]

    // Create both handlers
    eventProcessor = new EventProcessor(eventBus, {
      playerService,
      matchService,
      weaponService,
      rankingService,
      actionService,
      serverService,
      logger,
    }, coordinators)

    playerEventHandler = new PlayerEventHandler(
      eventBus,
      logger,
      playerService,
      serverService
    )
    
    weaponEventHandler = new WeaponEventHandler(
      eventBus,
      logger,
      weaponService
    )
    
    matchEventHandler = new MatchEventHandler(
      eventBus,
      logger,
      matchService
    )
  })

  afterEach(() => {
    eventProcessor.destroy()
    playerEventHandler.destroy()
    weaponEventHandler.destroy()
    matchEventHandler.destroy()
  })

  describe("Simple Player Events", () => {
    it("should process player events through player module only", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        meta: {
          steamId: "STEAM_1:0:12345",
          playerName: "TestPlayer",
          isBot: false,
        } as PlayerMeta,
      }

      await eventBus.emit(event)

      // Should be handled by PlayerEventHandler
      expect(playerService.handlePlayerEvent).toHaveBeenCalledTimes(1)
      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_CONNECT,
          data: expect.objectContaining({ playerId: 123 }),
        })
      )
    })

    it("should not duplicate processing for migrated events", async () => {
      const events = [
        EventType.PLAYER_CONNECT,
        EventType.PLAYER_DISCONNECT,
        EventType.PLAYER_CHANGE_NAME,
        EventType.CHAT_MESSAGE,
      ]

      for (const eventType of events) {
        vi.clearAllMocks()

        const event: BaseEvent = {
          eventType,
          serverId: 1,
          timestamp: new Date(),
          meta: {
            steamId: "STEAM_1:0:12345",
            playerName: "TestPlayer",
            isBot: false,
          } as PlayerMeta,
        }

        await eventBus.emit(event)

        // Should only be called once (by PlayerEventHandler)
        expect(playerService.handlePlayerEvent).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe("Complex Player Events", () => {
    it("should still process complex player events through EventProcessor", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_ENTRY,
        serverId: 1,
        timestamp: new Date(),
        meta: {
          steamId: "STEAM_1:0:12345",
          playerName: "TestPlayer",
          isBot: false,
        } as PlayerMeta,
      }

      await eventBus.emit(event)

      // Should be handled by EventProcessor
      expect(playerService.handlePlayerEvent).toHaveBeenCalledTimes(1)
      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_ENTRY,
        })
      )
    })
  })

  describe("Kill Events", () => {
    it("should coordinate kill events across multiple modules", async () => {
      const killEvent: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        meta: {
          killer: {
            steamId: "STEAM_1:0:11111",
            playerName: "Killer",
            isBot: false,
          },
          victim: {
            steamId: "STEAM_1:0:22222",
            playerName: "Victim",
            isBot: false,
          },
        } as DualPlayerMeta,
        data: {
          weapon: "ak47",
          headshot: true,
        },
      }

      await eventBus.emit(killEvent)

      // Verify each module processed the event
      // EventProcessor handles the kill event and calls player service directly
      expect(playerService.handleKillEvent).toHaveBeenCalledTimes(1)
      // WeaponEventHandler handles weapon statistics from kill events
      expect(weaponService.handleWeaponEvent).toHaveBeenCalledTimes(1)
      // MatchEventHandler handles match statistics from kill events
      expect(matchService.handleKillInMatch).toHaveBeenCalledTimes(1)
      // Coordinator handles ranking updates
      expect(rankingService.handleRatingUpdate).toHaveBeenCalledTimes(1)

      // Verify player IDs were resolved
      expect(playerService.getOrCreatePlayer).toHaveBeenCalledTimes(2)
    })
  })

  describe("Event Isolation", () => {
    it("should not affect non-player events", async () => {
      const matchEvent: BaseEvent = {
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { round: 1 },
      }

      await eventBus.emit(matchEvent)

      expect(matchService.handleMatchEvent).toHaveBeenCalledTimes(1)
      expect(playerService.handlePlayerEvent).not.toHaveBeenCalled()
    })

    it("should handle weapon events correctly", async () => {
      const weaponEvent: BaseEvent = {
        eventType: EventType.WEAPON_FIRE,
        serverId: 1,
        timestamp: new Date(),
        data: { weapon: "m4a1" },
      }

      await eventBus.emit(weaponEvent)

      expect(weaponService.handleWeaponEvent).toHaveBeenCalledTimes(1)
      expect(playerService.handlePlayerEvent).not.toHaveBeenCalled()
    })
  })

  describe("Error Handling", () => {
    it("should handle errors in PlayerEventHandler without affecting other handlers", async () => {
      const error = new Error("Player handler error")
      vi.mocked(playerService.handlePlayerEvent).mockRejectedValueOnce(error)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        meta: {
          steamId: "STEAM_1:0:12345",
          playerName: "TestPlayer",
          isBot: false,
        } as PlayerMeta,
      }

      // Should not throw
      await expect(eventBus.emit(event)).resolves.toBeUndefined()
    })

    it("should handle errors in EventProcessor without affecting PlayerEventHandler", async () => {
      const error = new Error("Match handler error")
      vi.mocked(matchService.handleMatchEvent).mockRejectedValueOnce(error)

      const matchEvent: BaseEvent = {
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { round: 1 },
      }

      const playerEvent: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        meta: {
          steamId: "STEAM_1:0:12345",
          playerName: "TestPlayer",
          isBot: false,
        } as PlayerMeta,
      }

      // Emit both events
      await eventBus.emit(matchEvent)
      await eventBus.emit(playerEvent)

      // Player event should still be processed
      expect(playerService.handlePlayerEvent).toHaveBeenCalledTimes(1)
    })
  })
})