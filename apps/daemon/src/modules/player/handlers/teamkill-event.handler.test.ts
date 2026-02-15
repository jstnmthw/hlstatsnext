/**
 * Teamkill Event Handler Tests
 *
 * Tests for player teamkill event handling.
 */

import type { IMapService } from "@/modules/map/map.service"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerRepository, PlayerTeamkillEvent } from "@/modules/player/types/player.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IEventNotificationService } from "@/modules/rcon/services/event-notification.service"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockMatchService } from "@/tests/mocks/match.service.mock"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TeamkillEventHandler } from "./teamkill-event.handler"

function createMockMapService(): IMapService {
  return {
    getCurrentMap: vi.fn().mockResolvedValue("de_dust2"),
    getLastKnownMap: vi.fn(),
    handleMapChange: vi.fn(),
  }
}

function createMockRankingService(): IRankingService {
  return {
    calculateRatingAdjustment: vi.fn().mockResolvedValue({ winner: 10, loser: -10 }),
    calculateSkillAdjustment: vi.fn().mockResolvedValue({ killerChange: 10, victimChange: -5 }),
    calculateSuicidePenalty: vi.fn().mockReturnValue(-3),
    calculateTeamkillPenalty: vi.fn().mockReturnValue(-10),
    getPlayerRankPosition: vi.fn().mockResolvedValue(1),
    getBatchPlayerRanks: vi.fn().mockResolvedValue(new Map()),
  }
}

function createMockNotificationService(): IEventNotificationService {
  return {
    notifyKillEvent: vi.fn(),
    notifySuicideEvent: vi.fn(),
    notifyTeamKillEvent: vi.fn(),
    notifyActionEvent: vi.fn(),
    notifyTeamActionEvent: vi.fn(),
    notifyConnectEvent: vi.fn(),
    notifyDisconnectEvent: vi.fn(),
    isEventTypeEnabled: vi.fn().mockResolvedValue(true),
  }
}

describe("TeamkillEventHandler", () => {
  let handler: TeamkillEventHandler
  let mockRepository: IPlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockMatchService: IMatchService
  let mockMapService: IMapService
  let mockRankingService: IRankingService
  let mockNotificationService: IEventNotificationService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockPlayerRepository()
    mockMatchService = createMockMatchService()
    mockMapService = createMockMapService()
    mockRankingService = createMockRankingService()
    mockNotificationService = createMockNotificationService()

    handler = new TeamkillEventHandler(
      mockRepository,
      mockLogger,
      mockMatchService,
      mockMapService,
      mockRankingService,
      mockNotificationService,
    )
  })

  describe("handle", () => {
    it("should process valid PLAYER_TEAMKILL event", async () => {
      const event: PlayerTeamkillEvent = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 100,
          victimId: 200,
          weapon: "ak47",
          headshot: false,
          team: "CT",
        },
        meta: {
          killer: {
            playerName: "TeamKiller",
            steamId: "STEAM_0:1:111",
            isBot: false,
          },
          victim: {
            playerName: "Teammate",
            steamId: "STEAM_0:1:222",
            isBot: false,
          },
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
    })

    it("should return error for invalid event type", async () => {
      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: { killerId: 100, victimId: 200 },
      } as any

      const result = await handler.handle(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid event type")
    })

    it("should apply skill penalty to killer", async () => {
      const event: PlayerTeamkillEvent = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 100,
          victimId: 200,
          weapon: "m4a1",
          headshot: false,
          team: "CT",
        },
      }

      await handler.handle(event)

      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          teamkills: { increment: 1 },
          skill: { increment: -10 },
        }),
      )
    })

    it("should increment deaths for victim", async () => {
      const event: PlayerTeamkillEvent = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 100,
          victimId: 200,
          weapon: "awp",
          headshot: false,
          team: "CT",
        },
      }

      await handler.handle(event)

      expect(mockRepository.update).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          deaths: { increment: 1 },
        }),
      )
    })

    it("should track headshots", async () => {
      const event: PlayerTeamkillEvent = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 100,
          victimId: 200,
          weapon: "deagle",
          headshot: true,
          team: "CT",
        },
      }

      await handler.handle(event)

      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          headshots: { increment: 1 },
        }),
      )
    })

    it("should create teamkill event log", async () => {
      const event: PlayerTeamkillEvent = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 2,
        data: {
          killerId: 100,
          victimId: 200,
          weapon: "knife",
          headshot: false,
          team: "CT",
        },
      }

      await handler.handle(event)

      expect(mockRepository.createTeamkillEvent).toHaveBeenCalledWith(
        100,
        200,
        2,
        "de_dust2",
        "knife",
      )
    })

    it("should send teamkill notification", async () => {
      const event: PlayerTeamkillEvent = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 100,
          victimId: 200,
          weapon: "ak47",
          headshot: false,
          team: "CT",
        },
        meta: {
          killer: {
            playerName: "BadPlayer",
            steamId: "STEAM_0:1:111",
            isBot: false,
          },
          victim: {
            playerName: "VictimPlayer",
            steamId: "STEAM_0:1:222",
            isBot: false,
          },
        },
      }

      await handler.handle(event)

      expect(mockNotificationService.notifyTeamKillEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 1,
          killerId: 100,
          victimId: 200,
          killerName: "BadPlayer",
          victimName: "VictimPlayer",
          weapon: "ak47",
          headshot: false,
          skillPenalty: -10,
        }),
      )
    })

    it("should update player name stats", async () => {
      const event: PlayerTeamkillEvent = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 100,
          victimId: 200,
          weapon: "glock",
          headshot: false,
          team: "CT",
        },
        meta: {
          killer: {
            playerName: "Killer",
            steamId: "STEAM_0:1:111",
            isBot: false,
          },
          victim: {
            playerName: "Victim",
            steamId: "STEAM_0:1:222",
            isBot: false,
          },
        },
      }

      await handler.handle(event)

      // Killer name update
      expect(mockRepository.upsertPlayerName).toHaveBeenCalledWith(
        100,
        "Killer",
        expect.any(Object),
      )

      // Victim name update with death
      expect(mockRepository.upsertPlayerName).toHaveBeenCalledWith(
        200,
        "Victim",
        expect.objectContaining({
          deaths: 1,
        }),
      )
    })

    it("should use default penalty when no ranking service", async () => {
      const handlerWithoutRanking = new TeamkillEventHandler(
        mockRepository,
        mockLogger,
        mockMatchService,
        mockMapService,
        undefined,
        mockNotificationService,
      )

      const event: PlayerTeamkillEvent = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 100,
          victimId: 200,
          weapon: "usp",
          headshot: false,
          team: "CT",
        },
      }

      await handlerWithoutRanking.handle(event)

      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          skill: { increment: -5 }, // Default penalty
        }),
      )
    })

    it("should handle notification errors gracefully", async () => {
      vi.mocked(mockNotificationService.notifyTeamKillEvent).mockRejectedValue(
        new Error("Notification failed"),
      )

      const event: PlayerTeamkillEvent = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 100,
          victimId: 200,
          weapon: "ak47",
          headshot: false,
          team: "CT",
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send teamkill notification"),
      )
    })

    it("should log teamkill details", async () => {
      const event: PlayerTeamkillEvent = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 100,
          victimId: 200,
          weapon: "m249",
          headshot: false,
          team: "CT",
        },
      }

      await handler.handle(event)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Teamkill: 100 → 200 (m249)"),
      )
    })
  })
})
