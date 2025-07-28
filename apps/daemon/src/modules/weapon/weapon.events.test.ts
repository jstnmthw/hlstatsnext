/**
 * WeaponEventHandler Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { WeaponEventHandler } from "./weapon.events"
import { createMockLogger } from "../../tests/mocks/logger"
import { createMockEventBus } from "../../tests/mocks/event-bus"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import type { IWeaponService } from "./weapon.types"

// Create mock weapon service
const createMockWeaponService = (): IWeaponService => ({
  handleWeaponEvent: vi.fn(),
  updateWeaponStats: vi.fn(),
  compensateWeaponEvent: vi.fn(),
})

describe("WeaponEventHandler", () => {
  let handler: WeaponEventHandler
  let logger: ReturnType<typeof createMockLogger>
  let eventBus: ReturnType<typeof createMockEventBus>
  let weaponService: IWeaponService

  beforeEach(() => {
    logger = createMockLogger()
    eventBus = createMockEventBus()
    weaponService = createMockWeaponService()

    handler = new WeaponEventHandler(eventBus, logger, weaponService)
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
        "WeaponEventHandler unregistered all event handlers",
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
})