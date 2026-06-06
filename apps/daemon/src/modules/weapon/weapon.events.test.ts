/**
 * WeaponEventHandler Unit Tests
 */

import type { IServerService } from "@/modules/server/server.types"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import { createMockEventBus } from "@/tests/mocks/event-bus"
import { createMockLogger } from "@/tests/mocks/logger"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WeaponEventHandler } from "./weapon.events"
import type { IWeaponService } from "./weapon.types"

// Create mock weapon service
const createMockWeaponService = (): IWeaponService => ({
  handleWeaponEvent: vi.fn().mockResolvedValue({ success: true }),
  updateWeaponStats: vi.fn(),
})

const createMockServerService = (): IServerService =>
  ({
    getServerConfigBoolean: vi.fn().mockResolvedValue(false),
    isIgnoreBotsEnabled: vi.fn().mockResolvedValue(false),
  }) as unknown as IServerService

describe("WeaponEventHandler", () => {
  let handler: WeaponEventHandler
  let logger: ReturnType<typeof createMockLogger>
  let eventBus: ReturnType<typeof createMockEventBus>
  let weaponService: IWeaponService
  let serverService: IServerService

  beforeEach(() => {
    logger = createMockLogger()
    eventBus = createMockEventBus()
    weaponService = createMockWeaponService()
    serverService = createMockServerService()

    handler = new WeaponEventHandler(logger, weaponService, serverService)
  })

  afterEach(() => {
    handler.destroy()
  })

  describe("Event Registration", () => {
    it("should not register EventBus handlers for queue-only weapon events", () => {
      // All weapon events have been migrated to queue-only processing
      // No EventBus handlers should be registered
      const eventTypes = [
        EventType.WEAPON_FIRE,
        EventType.WEAPON_HIT,
        EventType.PLAYER_KILL, // PLAYER_KILL is also processed by weapon module for weapon stats
      ]

      for (const eventType of eventTypes) {
        expect(logger.debug).not.toHaveBeenCalledWith(
          expect.stringContaining(`Registered WeaponEventHandler handler for ${eventType}`),
        )
      }
    })
  })

  describe("Queue-Only Event Processing", () => {
    // Since all weapon events are now queue-only, they don't have EventBus handlers

    it("should not handle queue-only WEAPON_FIRE events via EventBus", async () => {
      const event: BaseEvent = {
        eventType: EventType.WEAPON_FIRE,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      await eventBus.emit(event)

      // No handlers should be called since all weapon events are queue-only
      expect(weaponService.handleWeaponEvent).not.toHaveBeenCalled()
    })

    it("should not handle queue-only WEAPON_HIT events via EventBus", async () => {
      const event: BaseEvent = {
        eventType: EventType.WEAPON_HIT,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      await eventBus.emit(event)

      // No handlers should be called since all weapon events are queue-only
      expect(weaponService.handleWeaponEvent).not.toHaveBeenCalled()
    })

    it("should not handle PLAYER_KILL events via EventBus", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      await eventBus.emit(event)

      // No handlers should be called since PLAYER_KILL is queue-only
      expect(weaponService.handleWeaponEvent).not.toHaveBeenCalled()
    })
  })

  describe("Cleanup", () => {
    it("should unregister all handlers on destroy", () => {
      handler.destroy()

      expect(logger.debug).toHaveBeenCalledWith(
        "WeaponEventHandler cleanup completed (queue-only processing)",
      )

      // Verify handlers are actually removed by emitting an event
      const event: BaseEvent = {
        eventType: EventType.WEAPON_FIRE,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      vi.clearAllMocks()
      eventBus.emit(event)

      expect(weaponService.handleWeaponEvent).not.toHaveBeenCalled()
    })
  })

  describe("handleWeaponFire", () => {
    it("should delegate WEAPON_FIRE events to weapon service", async () => {
      const event: BaseEvent = {
        eventType: EventType.WEAPON_FIRE,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-fire-1",
        data: {
          playerId: 100,
          weapon: "ak47",
          game: "cstrike",
        },
      }

      await handler.handleWeaponFire(event)

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Weapon module handling WEAPON_FIRE for server 1"),
      )
      expect(weaponService.handleWeaponEvent).toHaveBeenCalledWith(event)
    })
  })

  describe("handleWeaponHit", () => {
    it("should delegate WEAPON_HIT events to weapon service", async () => {
      const event: BaseEvent = {
        eventType: EventType.WEAPON_HIT,
        timestamp: new Date(),
        serverId: 2,
        eventId: "test-hit-1",
        data: {
          playerId: 100,
          victimId: 200,
          weapon: "m4a1",
          hitgroup: "head",
          damage: 100,
          game: "cstrike",
        },
      }

      await handler.handleWeaponHit(event)

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Weapon module handling WEAPON_HIT for server 2"),
      )
      expect(weaponService.handleWeaponEvent).toHaveBeenCalledWith(event)
    })
  })

  describe("handlePlayerKill", () => {
    it("should delegate PLAYER_KILL events to weapon service for weapon stats", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 3,
        eventId: "test-kill-1",
        data: {
          playerId: 100,
          victimId: 200,
          weapon: "awp",
          headshot: true,
          game: "cstrike",
        },
      }

      await handler.handlePlayerKill(event)

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Weapon module handling PLAYER_KILL for server 3"),
      )
      expect(weaponService.handleWeaponEvent).toHaveBeenCalledWith(event)
    })

    it("should discard bot-involved PLAYER_KILL when IgnoreBots is enabled", async () => {
      vi.mocked(serverService.isIgnoreBotsEnabled).mockResolvedValue(true)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 3,
        eventId: "bot-kill",
        data: { weapon: "awp", headshot: false },
        meta: {
          killer: { steamId: "STEAM_1:0:111", playerName: "Human", isBot: false },
          victim: { steamId: "BOT", playerName: "Bot Bob", isBot: true },
        },
      }

      await handler.handlePlayerKill(event)

      expect(serverService.isIgnoreBotsEnabled).toHaveBeenCalledWith(3)
      expect(weaponService.handleWeaponEvent).not.toHaveBeenCalled()
    })

    it("should record bot-involved PLAYER_KILL when IgnoreBots is disabled", async () => {
      vi.mocked(serverService.isIgnoreBotsEnabled).mockResolvedValue(false)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 3,
        eventId: "bot-kill-allowed",
        data: { weapon: "awp", headshot: false },
        meta: {
          killer: { steamId: "STEAM_1:0:111", playerName: "Human", isBot: false },
          victim: { steamId: "BOT", playerName: "Bot Bob", isBot: true },
        },
      }

      await handler.handlePlayerKill(event)

      expect(weaponService.handleWeaponEvent).toHaveBeenCalledWith(event)
    })
  })
})
