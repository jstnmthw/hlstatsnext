/**
 * Kill Event Saga Tests
 *
 * Tests for the saga-based kill event processing with compensation
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { KillEventSaga, PlayerKillStep } from "./kill-event.saga"
import { SagaMonitor } from "../saga.monitor"
import { EventBus } from "@/shared/infrastructure/event-bus/event-bus"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerService, PlayerKillEvent } from "@/modules/player/player.types"
import type { IWeaponService } from "@/modules/weapon/weapon.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import { EventType } from "@/shared/types/events"
import type { BaseEvent, DualPlayerMeta } from "@/shared/types/events"

describe("KillEventSaga", () => {
  let saga: KillEventSaga
  let eventBus: IEventBus
  let logger: ILogger
  let playerService: IPlayerService
  let weaponService: IWeaponService
  let matchService: IMatchService
  let rankingService: IRankingService
  let monitor: SagaMonitor

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger

    eventBus = new EventBus(logger)

    playerService = {
      handleKillEvent: vi.fn().mockResolvedValue({ 
        success: true, 
        affected: 2,
      }),
      compensateKillEvent: vi.fn(),
    } as unknown as IPlayerService

    weaponService = {
      handleWeaponEvent: vi.fn(),
      compensateWeaponEvent: vi.fn(),
    } as unknown as IWeaponService

    matchService = {
      handleKillInMatch: vi.fn(),
      compensateKillInMatch: vi.fn(),
    } as unknown as IMatchService

    rankingService = {
      handleRatingUpdate: vi.fn(),
      getCurrentRankings: vi.fn().mockResolvedValue({ rankings: "test" }),
      restoreRankings: vi.fn(),
    } as unknown as IRankingService

    monitor = new SagaMonitor(logger)

    saga = new KillEventSaga(
      logger,
      eventBus,
      playerService,
      weaponService,
      matchService,
      rankingService,
      monitor,
    )
  })

  describe("Successful Execution", () => {
    it("should execute all steps successfully for kill event", async () => {
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

      await saga.execute(killEvent)

      // Verify all steps were executed
      expect(playerService.handleKillEvent).toHaveBeenCalledTimes(1)
      expect(weaponService.handleWeaponEvent).toHaveBeenCalledTimes(1)
      expect(matchService.handleKillInMatch).toHaveBeenCalledTimes(1)
      expect(rankingService.handleRatingUpdate).toHaveBeenCalledTimes(1)

      // Verify no compensations were called
      expect(playerService.compensateKillEvent).not.toHaveBeenCalled()
      expect(weaponService.compensateWeaponEvent).not.toHaveBeenCalled()
      expect(matchService.compensateKillInMatch).not.toHaveBeenCalled()
      expect(rankingService.restoreRankings).not.toHaveBeenCalled()
    })

    it("should skip execution for non-kill events", async () => {
      const nonKillEvent: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      await saga.execute(nonKillEvent)

      // Verify no steps were executed
      expect(playerService.handleKillEvent).not.toHaveBeenCalled()
      expect(weaponService.handleWeaponEvent).not.toHaveBeenCalled()
      expect(matchService.handleKillInMatch).not.toHaveBeenCalled()
      expect(rankingService.handleRatingUpdate).not.toHaveBeenCalled()
    })
  })

  describe("Failure and Compensation", () => {
    it("should run compensations when weapon step fails", async () => {
      const error = new Error("Weapon service failed")
      vi.mocked(weaponService.handleWeaponEvent).mockRejectedValueOnce(error)

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "ak47",
          headshot: false,
          killerTeam: "T",
          victimTeam: "CT",
        },
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
      }

      await expect(saga.execute(killEvent)).rejects.toThrow("Weapon service failed")

      // Verify player step was executed then compensated
      expect(playerService.handleKillEvent).toHaveBeenCalledTimes(1)
      expect(playerService.compensateKillEvent).toHaveBeenCalledTimes(1)

      // Verify weapon step was attempted but failed
      expect(weaponService.handleWeaponEvent).toHaveBeenCalledTimes(1)
      expect(weaponService.compensateWeaponEvent).not.toHaveBeenCalled()

      // Verify subsequent steps were not executed
      expect(matchService.handleKillInMatch).not.toHaveBeenCalled()
      expect(rankingService.handleRatingUpdate).not.toHaveBeenCalled()
    })

    it("should run compensations when ranking step fails", async () => {
      const error = new Error("Ranking service failed")
      vi.mocked(rankingService.handleRatingUpdate).mockRejectedValueOnce(error)

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "ak47",
          headshot: false,
          killerTeam: "T",
          victimTeam: "CT",
        },
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
      }

      await expect(saga.execute(killEvent)).rejects.toThrow("Ranking service failed")

      // Verify all preceding steps were compensated in reverse order
      expect(matchService.compensateKillInMatch).toHaveBeenCalledTimes(1)
      expect(weaponService.compensateWeaponEvent).toHaveBeenCalledTimes(1)
      expect(playerService.compensateKillEvent).toHaveBeenCalledTimes(1)

      // Verify ranking service compensation was not called (it failed)
      expect(rankingService.restoreRankings).not.toHaveBeenCalled()
    })

    it("should continue compensations even if one fails", async () => {
      const serviceError = new Error("Service failed")
      const compensationError = new Error("Compensation failed")

      vi.mocked(rankingService.handleRatingUpdate).mockRejectedValueOnce(serviceError)
      vi.mocked(weaponService.compensateWeaponEvent!).mockRejectedValueOnce(compensationError)

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "ak47",
          headshot: false,
          killerTeam: "T",
          victimTeam: "CT",
        },
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
      }

      await expect(saga.execute(killEvent)).rejects.toThrow("Service failed")

      // Verify compensations were attempted for all completed steps
      expect(matchService.compensateKillInMatch).toHaveBeenCalledTimes(1)
      expect(weaponService.compensateWeaponEvent).toHaveBeenCalledTimes(1)
      expect(playerService.compensateKillEvent).toHaveBeenCalledTimes(1)

      // Verify error was logged for failed compensation
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to compensate weapon stats step"),
        expect.any(Object),
      )
    })
  })

  describe("Individual Steps", () => {
    describe("PlayerKillStep", () => {
      it("should execute and mark context as processed", async () => {
        const step = new PlayerKillStep(playerService, logger)
        const context = {
          eventId: "test-event",
          correlationId: "test-correlation",
          originalEvent: {
            eventType: EventType.PLAYER_KILL,
            data: { killerId: 123, victimId: 456 },
          } as BaseEvent,
          data: {},
        }

        await step.execute(context)

        expect(playerService.handleKillEvent).toHaveBeenCalledWith(context.originalEvent)
        expect((context.data as Record<string, unknown>).playerKillProcessed).toBe(true)
      })

      it("should compensate only if processed", async () => {
        const step = new PlayerKillStep(playerService, logger)
        const killEvent = {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(),
          data: {
            killerId: 123,
            victimId: 456,
            weapon: "ak47",
            headshot: false,
            killerTeam: "T",
            victimTeam: "CT",
          },
        } as PlayerKillEvent

        const context = {
          eventId: "test-event",
          correlationId: "test-correlation",
          originalEvent: killEvent,
          data: { playerKillProcessed: true },
        }

        await step.compensate(context)

        expect(playerService.compensateKillEvent).toHaveBeenCalledWith(123, 456)
      })

      it("should skip compensation if not processed", async () => {
        const step = new PlayerKillStep(playerService, logger)
        const context = {
          eventId: "test-event",
          correlationId: "test-correlation",
          originalEvent: { eventType: EventType.PLAYER_KILL } as BaseEvent,
          data: {},
        }

        await step.compensate(context)

        expect(playerService.compensateKillEvent).not.toHaveBeenCalled()
      })
    })
  })
})
