/**
 * Player Event Handler Tests
 * 
 * Tests for the distributed player event handling functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { PlayerEventHandler } from "./player.events"
import { EventBus } from "@/shared/infrastructure/event-bus/event-bus"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerService } from "@/modules/player/player.types"
import type { IServerService } from "@/modules/server/server.types"
import { EventType } from "@/shared/types/events"
import type { BaseEvent, PlayerMeta } from "@/shared/types/events"

describe("PlayerEventHandler", () => {
  let eventBus: IEventBus
  let logger: ILogger
  let playerService: IPlayerService
  let serverService: IServerService
  let handler: PlayerEventHandler

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger
    
    eventBus = new EventBus(logger)

    playerService = {
      handlePlayerEvent: vi.fn(),
      getOrCreatePlayer: vi.fn().mockResolvedValue(123),
      handleKillEvent: vi.fn(),
    } as unknown as IPlayerService

    serverService = {
      getServerGame: vi.fn().mockResolvedValue("csgo"),
    } as unknown as IServerService

    handler = new PlayerEventHandler(eventBus, logger, playerService, serverService)
  })

  afterEach(() => {
    handler.destroy()
  })

  describe("Event Registration", () => {
    it("should register handlers for simple player events", () => {
      const eventTypes = [
        EventType.PLAYER_CONNECT,
        EventType.PLAYER_DISCONNECT,
        EventType.PLAYER_CHANGE_NAME,
        EventType.CHAT_MESSAGE,
      ]

      for (const eventType of eventTypes) {
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(`Registered PlayerEventHandler handler for ${eventType}`)
        )
      }
    })

    it("should not register handlers for complex player events", () => {
      const complexEvents = [
        EventType.PLAYER_KILL,
        EventType.PLAYER_ENTRY,
        EventType.PLAYER_CHANGE_TEAM,
      ]

      for (const eventType of complexEvents) {
        expect(logger.debug).not.toHaveBeenCalledWith(
          expect.stringContaining(`Registered PlayerEventHandler handler for ${eventType}`)
        )
      }
    })
  })

  describe("Event Handling", () => {
    const createEvent = (eventType: EventType, meta?: PlayerMeta): BaseEvent => ({
      eventType,
      timestamp: new Date(),
      serverId: 1,
      meta,
      data: {},
    })

    it("should handle PLAYER_CONNECT event", async () => {
      const event = createEvent(EventType.PLAYER_CONNECT, {
        steamId: "STEAM_1:0:12345",
        playerName: "TestPlayer",
        isBot: false,
      })

      await eventBus.emit(event)

      expect(serverService.getServerGame).toHaveBeenCalledWith(1)
      expect(playerService.getOrCreatePlayer).toHaveBeenCalledWith(
        "STEAM_1:0:12345",
        "TestPlayer",
        "csgo"
      )
      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_CONNECT,
          data: expect.objectContaining({ playerId: 123 }),
        })
      )
    })

    it("should handle PLAYER_DISCONNECT event", async () => {
      const event = createEvent(EventType.PLAYER_DISCONNECT, {
        steamId: "STEAM_1:0:12345",
        playerName: "TestPlayer",
        isBot: false,
      })

      await eventBus.emit(event)

      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_DISCONNECT,
          data: expect.objectContaining({ playerId: 123 }),
        })
      )
    })

    it("should handle CHAT_MESSAGE event", async () => {
      const event = createEvent(EventType.CHAT_MESSAGE, {
        steamId: "STEAM_1:0:12345",
        playerName: "TestPlayer",
        isBot: false,
      })

      await eventBus.emit(event)

      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.CHAT_MESSAGE,
          data: expect.objectContaining({ playerId: 123 }),
        })
      )
    })

    it("should handle events without player metadata", async () => {
      const event = createEvent(EventType.PLAYER_CONNECT) // No meta

      await eventBus.emit(event)

      expect(playerService.getOrCreatePlayer).not.toHaveBeenCalled()
      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_CONNECT,
          data: {},
        })
      )
    })

    it("should handle player ID resolution errors gracefully", async () => {
      const error = new Error("Database error")
      vi.mocked(playerService.getOrCreatePlayer).mockRejectedValueOnce(error)

      const event = createEvent(EventType.PLAYER_CONNECT, {
        steamId: "STEAM_1:0:12345",
        playerName: "TestPlayer",
        isBot: false,
      })

      await eventBus.emit(event)

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resolve player IDs")
      )
      
      // Should still call handlePlayerEvent with original event
      expect(playerService.handlePlayerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_CONNECT,
          data: {},
        })
      )
    })
  })

  describe("Cleanup", () => {
    it("should unregister all handlers on destroy", () => {
      handler.destroy()

      expect(logger.debug).toHaveBeenCalledWith(
        "PlayerEventHandler unregistered all event handlers"
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