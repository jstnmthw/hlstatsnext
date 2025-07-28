/**
 * Weapon Event Handler Tests
 *
 * Tests for the distributed weapon event handling functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { WeaponEventHandler } from "./weapon.events"
import { EventBus } from "@/shared/infrastructure/event-bus/event-bus"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IWeaponService } from "@/modules/weapon/weapon.types"
import { EventType } from "@/shared/types/events"
import type { BaseEvent } from "@/shared/types/events"

describe("WeaponEventHandler", () => {
  let eventBus: IEventBus
  let logger: ILogger
  let weaponService: IWeaponService
  let handler: WeaponEventHandler

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger

    eventBus = new EventBus(logger)

    weaponService = {
      handleWeaponEvent: vi.fn(),
    } as unknown as IWeaponService

    handler = new WeaponEventHandler(eventBus, logger, weaponService)
  })

  afterEach(() => {
    handler.destroy()
  })

  describe("Event Registration", () => {
    it("should register handlers for weapon events", () => {
      const eventTypes = [
        EventType.WEAPON_FIRE,
        EventType.WEAPON_HIT,
        EventType.PLAYER_KILL, // For weapon statistics
      ]

      for (const eventType of eventTypes) {
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(`Registered WeaponEventHandler handler for ${eventType}`),
        )
      }
    })
  })

  describe("Weapon Event Handling", () => {
    it("should handle WEAPON_FIRE event", async () => {
      const event: BaseEvent = {
        eventType: EventType.WEAPON_FIRE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          weapon: "ak47",
          playerId: 123,
        },
      }

      await eventBus.emit(event)

      expect(weaponService.handleWeaponEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.WEAPON_FIRE,
          data: expect.objectContaining({ weapon: "ak47" }),
        }),
      )
    })

    it("should handle WEAPON_HIT event", async () => {
      const event: BaseEvent = {
        eventType: EventType.WEAPON_HIT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          weapon: "m4a1",
          damage: 27,
          hitgroup: "head",
        },
      }

      await eventBus.emit(event)

      expect(weaponService.handleWeaponEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.WEAPON_HIT,
          data: expect.objectContaining({ weapon: "m4a1", damage: 27 }),
        }),
      )
    })

    it("should process PLAYER_KILL events for weapon statistics", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "awp",
          headshot: true,
        },
      }

      await eventBus.emit(event)

      expect(logger.debug).toHaveBeenCalledWith(
        "Weapon module processing kill event for weapon stats",
      )
      expect(weaponService.handleWeaponEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          data: expect.objectContaining({ weapon: "awp" }),
        }),
      )
    })
  })

  describe("Cleanup", () => {
    it("should unregister all handlers on destroy", () => {
      handler.destroy()

      expect(logger.debug).toHaveBeenCalledWith(
        "WeaponEventHandler unregistered all event handlers",
      )

      // Verify handlers are actually removed
      vi.clearAllMocks()
      const event: BaseEvent = {
        eventType: EventType.WEAPON_FIRE,
        timestamp: new Date(),
        serverId: 1,
        data: { weapon: "glock" },
      }

      eventBus.emit(event)
      expect(weaponService.handleWeaponEvent).not.toHaveBeenCalled()
    })
  })
})
