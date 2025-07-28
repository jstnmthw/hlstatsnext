/**
 * Distributed Event Processing Integration Tests
 *
 * Tests that ensure the migration from centralized to distributed
 * event processing maintains system integrity
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { EventBus } from "@/shared/infrastructure/messaging/event-bus/event-bus"
import { EventType } from "@/shared/types/events"
import { PlayerEventHandler } from "@/modules/player/player.events"
import { WeaponEventHandler } from "@/modules/weapon/weapon.events"
import { MatchEventHandler } from "@/modules/match/match.events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerService } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IWeaponService } from "@/modules/weapon/weapon.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IServerService } from "@/modules/server/server.types"
import type { BaseEvent, PlayerMeta, DualPlayerMeta } from "@/shared/types/events"

describe("Distributed Event Processing", () => {
  let eventBus: EventBus
  let logger: ILogger
  let playerService: IPlayerService
  let matchService: IMatchService
  let weaponService: IWeaponService
  let rankingService: IRankingService
  let serverService: IServerService
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

    serverService = {
      getServerGame: vi.fn().mockResolvedValue("csgo"),
    } as unknown as IServerService

    // Create event bus
    eventBus = new EventBus(logger)

    playerEventHandler = new PlayerEventHandler(logger, playerService, serverService)

    weaponEventHandler = new WeaponEventHandler(logger, weaponService)

    matchEventHandler = new MatchEventHandler(logger, matchService)
  })

  afterEach(() => {
    // EventProcessor removed - all events now queue-only
    playerEventHandler.destroy()
    weaponEventHandler.destroy()
    matchEventHandler.destroy()
  })

  describe("Simple Player Events", () => {
    it("should no longer process simple player events through EventBus (migrated to queue-only)", async () => {
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

      // Should NOT be handled by EventBus - migrated to queue-only processing
      expect(playerService.handlePlayerEvent).toHaveBeenCalledTimes(0)
    })

    it("should confirm migrated events are not processed through EventBus", async () => {
      const migratedEvents = [
        EventType.PLAYER_CONNECT,
        EventType.PLAYER_DISCONNECT,
        EventType.PLAYER_CHANGE_NAME,
        EventType.CHAT_MESSAGE,
      ]

      for (const eventType of migratedEvents) {
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

        // Should NOT be processed through EventBus (migrated to queue-only)
        expect(playerService.handlePlayerEvent).toHaveBeenCalledTimes(0)
      }
    })
  })

  describe("Complex Player Events", () => {
    it("should no longer process complex player events through EventBus (migrated to queue-only)", async () => {
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

      // Should NOT be handled by EventBus - all events migrated to queue-only
      expect(playerService.handlePlayerEvent).toHaveBeenCalledTimes(0)
    })
  })

  describe("Kill Events", () => {
    it("should no longer process kill events through EventBus (migrated to queue-only)", async () => {
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

      // Verify no EventBus handlers processed the kill event (migrated to queue-only)
      // EventProcessor no longer handles kill events (migrated to RabbitMQ)
      expect(playerService.handleKillEvent).toHaveBeenCalledTimes(0)
      // WeaponEventHandler should not handle kill events via EventBus anymore
      expect(weaponService.handleWeaponEvent).toHaveBeenCalledTimes(0)
      // MatchEventHandler should not handle kill events via EventBus anymore
      expect(matchService.handleKillInMatch).toHaveBeenCalledTimes(0)
      // Coordinator should not handle kill events via EventBus anymore
      expect(rankingService.handleRatingUpdate).toHaveBeenCalledTimes(0)

      // No player ID resolution should occur via EventBus path
      expect(playerService.getOrCreatePlayer).toHaveBeenCalledTimes(0)
    })
  })

  describe("Event Isolation", () => {
    it("should confirm match events are no longer processed through EventBus (migrated to queue-only)", async () => {
      const matchEvent: BaseEvent = {
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { round: 1 },
      }

      await eventBus.emit(matchEvent)

      // Should NOT be processed through EventBus (migrated to queue-only)
      expect(matchService.handleMatchEvent).toHaveBeenCalledTimes(0)
      expect(playerService.handlePlayerEvent).toHaveBeenCalledTimes(0)
    })

    it("should confirm weapon events are no longer processed through EventBus (migrated to queue-only)", async () => {
      const weaponEvent: BaseEvent = {
        eventType: EventType.WEAPON_FIRE,
        serverId: 1,
        timestamp: new Date(),
        data: { weapon: "m4a1" },
      }

      await eventBus.emit(weaponEvent)

      // Should NOT be processed through EventBus (migrated to queue-only)
      expect(weaponService.handleWeaponEvent).toHaveBeenCalledTimes(0)
      expect(playerService.handlePlayerEvent).toHaveBeenCalledTimes(0)
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

    it("should confirm no error isolation needed (all handlers migrated to queue-only)", async () => {
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

      // Neither event should be processed through EventBus (both migrated to queue-only)
      expect(playerService.handlePlayerEvent).toHaveBeenCalledTimes(0)
      expect(matchService.handleMatchEvent).toHaveBeenCalledTimes(0)
    })
  })
})
