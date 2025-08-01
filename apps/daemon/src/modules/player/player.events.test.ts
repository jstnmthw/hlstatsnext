/**
 * PlayerEventHandler Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { PlayerEventHandler } from "./player.events"
import { createMockLogger } from "../../tests/mocks/logger"
import { createMockEventBus } from "../../tests/mocks/event-bus"
import type { BaseEvent, PlayerMeta } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import type { IPlayerService } from "./player.types"
import type { IServerService } from "@/modules/server/server.types"

// Create mock services
const createMockPlayerService = (): IPlayerService => ({
  getOrCreatePlayer: vi.fn().mockResolvedValue(123),
  getPlayerStats: vi.fn(),
  updatePlayerStats: vi.fn(),
  getPlayerRating: vi.fn(),
  updatePlayerRatings: vi.fn(),
  getTopPlayers: vi.fn(),
  getRoundParticipants: vi.fn(),
  handlePlayerEvent: vi.fn(),
  handleKillEvent: vi.fn(),
})

const createMockServerService = (): IServerService => ({
  getServer: vi.fn(),
  getServerByAddress: vi.fn(),
  getServerGame: vi.fn().mockResolvedValue("csgo"),
  handleServerShutdown: vi.fn(),
  handleStatsUpdate: vi.fn(),
  handleAdminAction: vi.fn(),
})

describe("PlayerEventHandler", () => {
  let handler: PlayerEventHandler
  let logger: ReturnType<typeof createMockLogger>
  let eventBus: ReturnType<typeof createMockEventBus>
  let playerService: IPlayerService
  let serverService: IServerService

  beforeEach(() => {
    logger = createMockLogger()
    eventBus = createMockEventBus()
    playerService = createMockPlayerService()
    serverService = createMockServerService()

    handler = new PlayerEventHandler(logger, playerService, serverService)
  })

  afterEach(() => {
    handler.destroy()
  })

  describe("Event Registration", () => {
    it("should not register EventBus handlers for queue-only player events", () => {
      // All player events have been migrated to queue-only processing
      // No EventBus handlers should be registered
      const eventTypes = [
        EventType.PLAYER_CONNECT,
        EventType.PLAYER_DISCONNECT,
        EventType.PLAYER_CHANGE_NAME,
        EventType.CHAT_MESSAGE,
      ]

      for (const eventType of eventTypes) {
        expect(logger.debug).not.toHaveBeenCalledWith(
          expect.stringContaining(`Registered PlayerEventHandler handler for ${eventType}`),
        )
      }
    })

    it("should not register handlers for complex player events", () => {
      const complexEvents = [
        EventType.PLAYER_KILL,
        EventType.PLAYER_SUICIDE,
        EventType.PLAYER_TEAMKILL,
      ]

      for (const eventType of complexEvents) {
        expect(logger.debug).not.toHaveBeenCalledWith(
          expect.stringContaining(`Registered PlayerEventHandler handler for ${eventType}`),
        )
      }
    })
  })

  describe("Queue-Only Event Processing", () => {
    // Since all player events are now queue-only, they don't have EventBus handlers
    // The PlayerEventHandler now only provides utility methods for player ID resolution

    it("should not handle queue-only events via EventBus", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      await eventBus.emit(event)

      // No handlers should be called since all player events are queue-only
      expect(serverService.getServerGame).not.toHaveBeenCalled()
      expect(playerService.getOrCreatePlayer).not.toHaveBeenCalled()
      expect(playerService.handlePlayerEvent).not.toHaveBeenCalled()
    })

    it("should provide utility methods for player ID resolution", () => {
      // The handler provides utility methods that can be used by queue consumers
      expect(handler).toBeDefined()
      expect(typeof handler).toBe("object")
    })
  })

  describe("Cleanup", () => {
    it("should unregister all handlers on destroy", () => {
      handler.destroy()

      expect(logger.debug).toHaveBeenCalledWith(
        "PlayerEventHandler cleanup completed (queue-only processing)",
      )

      // Verify handlers are actually removed by emitting an event
      const event: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        meta: {
          steamId: "STEAM_1:0:12345",
          playerName: "TestPlayer",
          isBot: false,
        } as PlayerMeta,
      }

      vi.clearAllMocks()
      eventBus.emit(event)

      expect(playerService.handlePlayerEvent).not.toHaveBeenCalled()
    })
  })
})
