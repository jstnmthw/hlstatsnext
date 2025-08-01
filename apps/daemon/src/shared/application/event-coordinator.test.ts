/**
 * Event Coordinator Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  KillEventCoordinator,
  CompositeEventCoordinator,
  type EventCoordinator,
} from "./event-coordinator"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"

describe("Event Coordinators", () => {
  let logger: ILogger
  let rankingService: IRankingService

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger

    rankingService = {
      handleRatingUpdate: vi.fn().mockResolvedValue({ success: true }),
      calculateRatingAdjustment: vi.fn(),
      calculateSkillAdjustment: vi.fn(),
      calculateSuicidePenalty: vi.fn(),
    } as unknown as IRankingService
  })

  describe("KillEventCoordinator", () => {
    let coordinator: KillEventCoordinator

    beforeEach(() => {
      coordinator = new KillEventCoordinator(logger, rankingService)
    })

    it("should handle kill events and update rankings", async () => {
      const killEvent: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "ak47",
        },
      }

      await coordinator.coordinateEvent(killEvent)

      expect(logger.debug).toHaveBeenCalledWith("Coordinating cross-module kill event processing")
      expect(rankingService.handleRatingUpdate).toHaveBeenCalledTimes(1)
    })

    it("should skip non-kill events", async () => {
      const connectEvent: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await coordinator.coordinateEvent(connectEvent)

      expect(rankingService.handleRatingUpdate).not.toHaveBeenCalled()
    })

    it("should propagate errors from ranking service", async () => {
      const error = new Error("Ranking update failed")
      vi.mocked(rankingService.handleRatingUpdate).mockRejectedValueOnce(error)

      const killEvent: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await expect(coordinator.coordinateEvent(killEvent)).rejects.toThrow("Ranking update failed")
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Kill event coordination failed"),
      )
    })
  })


  describe("CompositeEventCoordinator", () => {
    let coordinator: CompositeEventCoordinator
    let mockCoordinator1: EventCoordinator
    let mockCoordinator2: EventCoordinator
    let mockCoordinator3: EventCoordinator

    beforeEach(() => {
      mockCoordinator1 = {
        coordinateEvent: vi.fn().mockResolvedValue(undefined),
      }
      mockCoordinator2 = {
        coordinateEvent: vi.fn().mockResolvedValue(undefined),
      }
      mockCoordinator3 = {
        coordinateEvent: vi.fn().mockResolvedValue(undefined),
      }

      coordinator = new CompositeEventCoordinator(
        [mockCoordinator1, mockCoordinator2, mockCoordinator3],
        logger,
      )
    })

    it("should execute all coordinators for an event", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await coordinator.coordinateEvent(event)

      expect(mockCoordinator1.coordinateEvent).toHaveBeenCalledWith(event)
      expect(mockCoordinator2.coordinateEvent).toHaveBeenCalledWith(event)
      expect(mockCoordinator3.coordinateEvent).toHaveBeenCalledWith(event)
    })

    it("should continue execution even if one coordinator fails", async () => {
      const error = new Error("Coordinator 2 failed")
      vi.mocked(mockCoordinator2.coordinateEvent).mockRejectedValueOnce(error)

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await coordinator.coordinateEvent(event)

      expect(mockCoordinator1.coordinateEvent).toHaveBeenCalledWith(event)
      expect(mockCoordinator2.coordinateEvent).toHaveBeenCalledWith(event)
      expect(mockCoordinator3.coordinateEvent).toHaveBeenCalledWith(event)

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Coordinator Object failed"),
      )
    })

    it("should handle multiple coordinator failures", async () => {
      const error1 = new Error("Coordinator 1 failed")
      const error3 = new Error("Coordinator 3 failed")

      vi.mocked(mockCoordinator1.coordinateEvent).mockRejectedValueOnce(error1)
      vi.mocked(mockCoordinator3.coordinateEvent).mockRejectedValueOnce(error3)

      const event: BaseEvent = {
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await coordinator.coordinateEvent(event)

      expect(mockCoordinator2.coordinateEvent).toHaveBeenCalledWith(event)
      expect(logger.error).toHaveBeenCalledTimes(2)
    })

    it("should work with empty coordinator list", async () => {
      const emptyCoordinator = new CompositeEventCoordinator([], logger)
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await expect(emptyCoordinator.coordinateEvent(event)).resolves.toBeUndefined()
    })

    it("should preserve coordinator execution order", async () => {
      const executionOrder: string[] = []

      const orderedCoordinator1 = {
        coordinateEvent: vi.fn().mockImplementation(async () => {
          executionOrder.push("coordinator1")
        }),
      }

      const orderedCoordinator2 = {
        coordinateEvent: vi.fn().mockImplementation(async () => {
          executionOrder.push("coordinator2")
        }),
      }

      const orderedCoordinator3 = {
        coordinateEvent: vi.fn().mockImplementation(async () => {
          executionOrder.push("coordinator3")
        }),
      }

      const orderedComposite = new CompositeEventCoordinator(
        [orderedCoordinator1, orderedCoordinator2, orderedCoordinator3],
        logger,
      )

      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await orderedComposite.coordinateEvent(event)

      expect(executionOrder).toEqual(["coordinator1", "coordinator2", "coordinator3"])
    })
  })
})
