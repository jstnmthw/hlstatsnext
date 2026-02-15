/**
 * Suicide Event Handler Tests
 *
 * Tests for player suicide event handling.
 */

import type { IMapService } from "@/modules/map/map.service"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerRepository, PlayerSuicideEvent } from "@/modules/player/types/player.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IEventNotificationService } from "@/modules/rcon/services/event-notification.service"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockMatchService } from "@/tests/mocks/match.service.mock"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuicideEventHandler } from "./suicide-event.handler"

function createMockRankingService(): IRankingService {
  return {
    calculateSkillAdjustment: vi.fn(),
    calculateRatingAdjustment: vi.fn(),
    calculateSuicidePenalty: vi.fn().mockReturnValue(-10),
    calculateTeamkillPenalty: vi.fn(),
    getPlayerRankPosition: vi.fn(),
    getBatchPlayerRanks: vi.fn(),
  }
}

function createMockMapService(): IMapService {
  return {
    getCurrentMap: vi.fn().mockResolvedValue("de_dust2"),
    getLastKnownMap: vi.fn(),
    handleMapChange: vi.fn(),
  }
}

function createMockEventNotificationService(): IEventNotificationService {
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

describe("SuicideEventHandler", () => {
  let handler: SuicideEventHandler
  let mockRepository: IPlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockRankingService: IRankingService
  let mockMatchService: IMatchService
  let mockMapService: IMapService
  let mockNotificationService: IEventNotificationService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockPlayerRepository()
    mockRankingService = createMockRankingService()
    mockMatchService = createMockMatchService()
    mockMapService = createMockMapService()
    mockNotificationService = createMockEventNotificationService()

    handler = new SuicideEventHandler(
      mockRepository,
      mockLogger,
      mockRankingService,
      mockMatchService,
      mockMapService,
      mockNotificationService,
    )
  })

  describe("handle", () => {
    it("should handle suicide event successfully", async () => {
      vi.mocked(mockRepository.getPlayerStats).mockResolvedValue({
        playerId: 100,
        skill: 1000,
        deathStreak: 0,
        killStreak: 5,
      } as any)

      const event: PlayerSuicideEvent = {
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          weapon: "world",
          team: "CT",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockRankingService.calculateSuicidePenalty).toHaveBeenCalled()
      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          suicides: { increment: 1 },
          deaths: { increment: 1 },
          skill: { increment: -10 },
        }),
      )
    })

    it("should increment death streak and reset kill streak", async () => {
      vi.mocked(mockRepository.getPlayerStats).mockResolvedValue({
        playerId: 100,
        skill: 1000,
        deathStreak: 2,
        killStreak: 3,
      } as any)

      const event: PlayerSuicideEvent = {
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          weapon: "hegrenade",
          team: "CT",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          deathStreak: 3, // Was 2, now 3
          killStreak: 0, // Reset
        }),
      )
    })

    it("should return error when player stats not found", async () => {
      vi.mocked(mockRepository.getPlayerStats).mockResolvedValue(null)

      const event: PlayerSuicideEvent = {
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 999,
          weapon: "world",
          team: "CT",
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Unable to retrieve player stats")
    })

    it("should return error for invalid event type", async () => {
      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      } as any

      const result = await handler.handle(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid event type")
    })

    it("should create suicide event log", async () => {
      vi.mocked(mockRepository.getPlayerStats).mockResolvedValue({
        playerId: 100,
        skill: 1000,
        deathStreak: 0,
        killStreak: 0,
      } as any)

      const event: PlayerSuicideEvent = {
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          weapon: "flashbang",
          team: "CT",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      expect(mockRepository.createSuicideEvent).toHaveBeenCalledWith(
        100,
        1,
        "de_dust2",
        "flashbang",
      )
    })

    it("should send suicide notification", async () => {
      vi.mocked(mockRepository.getPlayerStats)
        .mockResolvedValueOnce({
          playerId: 100,
          skill: 1000,
          deathStreak: 0,
          killStreak: 0,
        } as any)
        .mockResolvedValueOnce({
          playerId: 100,
          skill: 990, // After penalty
          deathStreak: 1,
          killStreak: 0,
        } as any)

      const event: PlayerSuicideEvent = {
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          weapon: "world",
          team: "CT",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      expect(mockNotificationService.notifySuicideEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 1,
          playerId: 100,
          playerName: "TestPlayer",
          weapon: "world",
          skillPenalty: -10,
        }),
      )
    })

    it("should handle notification failure gracefully", async () => {
      vi.mocked(mockRepository.getPlayerStats).mockResolvedValue({
        playerId: 100,
        skill: 1000,
        deathStreak: 0,
        killStreak: 0,
      } as any)

      vi.mocked(mockNotificationService.notifySuicideEvent).mockRejectedValue(
        new Error("Notification failed"),
      )

      const event: PlayerSuicideEvent = {
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          weapon: "world",
          team: "CT",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send suicide notification"),
      )
    })

    it("should update player name stats", async () => {
      vi.mocked(mockRepository.getPlayerStats).mockResolvedValue({
        playerId: 100,
        skill: 1000,
        deathStreak: 0,
        killStreak: 0,
      } as any)

      const event: PlayerSuicideEvent = {
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          weapon: "world",
          team: "CT",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      expect(mockRepository.upsertPlayerName).toHaveBeenCalledWith(
        100,
        "TestPlayer",
        expect.objectContaining({
          suicides: 1,
          deaths: 1,
        }),
      )
    })

    it("should update server stats", async () => {
      vi.mocked(mockRepository.getPlayerStats).mockResolvedValue({
        playerId: 100,
        skill: 1000,
        deathStreak: 0,
        killStreak: 0,
      } as any)

      const event: PlayerSuicideEvent = {
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          weapon: "world",
          team: "CT",
        },
      }

      await handler.handle(event)

      expect(mockRepository.updateServerForPlayerEvent).toHaveBeenCalledWith(1, {
        suicides: { increment: 1 },
        lastEvent: expect.any(Date),
      })
    })

    it("should handle different suicide weapons", async () => {
      const weapons = ["world", "hegrenade", "flashbang", "smokegrenade", "trigger_hurt"]

      for (const weapon of weapons) {
        vi.mocked(mockRepository.getPlayerStats).mockResolvedValue({
          playerId: 100,
          skill: 1000,
          deathStreak: 0,
          killStreak: 0,
        } as any)

        const event: PlayerSuicideEvent = {
          eventType: EventType.PLAYER_SUICIDE,
          timestamp: new Date(),
          serverId: 1,
          data: {
            playerId: 100,
            weapon,
            team: "CT",
          },
        }

        const result = await handler.handle(event)

        expect(result.success).toBe(true)
      }
    })
  })
})
