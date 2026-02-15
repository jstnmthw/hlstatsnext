/**
 * Kill Event Handler Unit Tests
 * Comprehensive test coverage for skill adjustment display fix and all handler functionality
 */

import type { IMapService } from "@/modules/map/map.service"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerRepository, PlayerKillEvent } from "@/modules/player/types/player.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IEventNotificationService } from "@/modules/rcon/services/event-notification.service"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import type { Player } from "@repo/database/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { KillEventHandler } from "./kill-event.handler"

describe("KillEventHandler", () => {
  let handler: KillEventHandler
  let mockPlayerRepository: IPlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockRankingService: IRankingService
  let mockMatchService: IMatchService
  let mockMapService: IMapService
  let mockEventNotificationService: IEventNotificationService

  const DEFAULT_RATING = 1000

  const createMockPlayer = (playerId: number, skill: number = DEFAULT_RATING): Player =>
    ({
      playerId,
      skill,
      kills: 10,
      deaths: 5,
      killStreak: 2,
      deathStreak: 0,
      lastName: `Player${playerId}`,
      country: "US",
      lastEvent: new Date(),
      createdAt: new Date(),
      clanId: null,
      fullName: null,
      email: null,
      city: "TestCity",
      state: null,
      flag: null,
      lat: null,
      lng: null,
      lastAddress: "127.0.0.1",
      game: "CS",
      suicides: 0,
      teamkills: 0,
      shots: 0,
      hits: 0,
      headshots: 0,
      gamesPlayed: 15,
      hide: 0,
      hideRanking: 0,
      hideTitle: 0,
      displayBy: 0,
      activity: 0,
      connectionTime: 0,
      lastSkillChange: new Date(),
      displayEvents: 0,
      blockAvatar: 0,
      mmrank: null,
    }) as unknown as Player

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockPlayerRepository = createMockPlayerRepository()

    mockRankingService = {
      calculateSkillAdjustment: vi.fn(),
      calculateRatingAdjustment: vi.fn(),
      calculateSuicidePenalty: vi.fn(),
      calculateTeamkillPenalty: vi.fn(),
      getPlayerRankPosition: vi.fn(),
      getBatchPlayerRanks: vi.fn(),
    }

    mockMatchService = {
      handleMatchEvent: vi.fn().mockResolvedValue({ success: true }),
      getMatchStats: vi.fn().mockReturnValue(undefined),
      resetMatchStats: vi.fn(),
      setPlayerTeam: vi.fn(),
      getPlayersByTeam: vi.fn().mockReturnValue([]),
      getServerGame: vi.fn().mockResolvedValue("cstrike"),
    }

    mockEventNotificationService = {
      notifyKillEvent: vi.fn().mockResolvedValue(undefined),
      notifySuicideEvent: vi.fn().mockResolvedValue(undefined),
      notifyTeamKillEvent: vi.fn().mockResolvedValue(undefined),
      notifyActionEvent: vi.fn().mockResolvedValue(undefined),
      notifyTeamActionEvent: vi.fn().mockResolvedValue(undefined),
      notifyConnectEvent: vi.fn().mockResolvedValue(undefined),
      notifyDisconnectEvent: vi.fn().mockResolvedValue(undefined),
      isEventTypeEnabled: vi.fn().mockResolvedValue(true),
    }

    mockMapService = {
      getCurrentMap: vi.fn().mockResolvedValue("de_dust2"),
      getLastKnownMap: vi.fn().mockResolvedValue("de_dust2"),
      handleMapChange: vi.fn(),
    }

    handler = new KillEventHandler(
      mockPlayerRepository,
      mockLogger,
      mockRankingService,
      mockMatchService,
      mockMapService,
      mockEventNotificationService,
    )
  })

  describe("Skill Adjustment Display Fix", () => {
    it("should send post-adjustment skill values in kill notification", async () => {
      // Setup test data
      const killerId = 1
      const victimId = 2
      const killerSkill = 1000
      const victimSkill = 950
      const skillAdjustment = { killerChange: 29, victimChange: -29 }

      const killerStats = createMockPlayer(killerId, killerSkill)
      const victimStats = createMockPlayer(victimId, victimSkill)

      // Mock repository responses
      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)

      // Mock ranking service
      mockRankingService.calculateSkillAdjustment = vi.fn().mockResolvedValue(skillAdjustment)

      // Create kill event
      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId,
          victimId,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
        meta: {
          killer: { steamId: "STEAM_1:0:123456", playerName: "Killer", isBot: false },
          victim: { steamId: "STEAM_1:0:654321", playerName: "Victim", isBot: false },
        },
      }

      // Execute handler
      const result = await handler.handle(killEvent)

      // Verify success
      expect(result.success).toBe(true)
      expect(result.affected).toBe(2)

      // Verify notification was called with POST-ADJUSTMENT skill values
      expect(mockEventNotificationService.notifyKillEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          killerSkill: killerSkill + skillAdjustment.killerChange, // 1029
          victimSkill: victimSkill + skillAdjustment.victimChange, // 921
          skillAdjustment,
        }),
      )
    })

    it("should handle default skill values correctly", async () => {
      const killerId = 1
      const victimId = 2
      const skillAdjustment = { killerChange: 15, victimChange: -15 }

      // Create players with null skills (new players)
      const killerStats = createMockPlayer(killerId, 0)
      const victimStats = createMockPlayer(victimId, 0)
      // Set skill to 0 to simulate new players (will use DEFAULT_RATING)
      killerStats.skill = 0
      victimStats.skill = 0

      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)

      mockRankingService.calculateSkillAdjustment = vi.fn().mockResolvedValue(skillAdjustment)

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId,
          victimId,
          weapon: "glock",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
        meta: {
          killer: { steamId: "STEAM_1:0:111111", playerName: "NewKiller", isBot: false },
          victim: { steamId: "STEAM_1:0:222222", playerName: "NewVictim", isBot: false },
        },
      }

      await handler.handle(killEvent)

      // Should use DEFAULT_RATING (1000) and apply adjustments
      expect(mockEventNotificationService.notifyKillEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          killerSkill: DEFAULT_RATING + skillAdjustment.killerChange, // 1015
          victimSkill: DEFAULT_RATING + skillAdjustment.victimChange, // 985
        }),
      )
    })

    it("should handle large skill adjustments correctly", async () => {
      const killerId = 1
      const victimId = 2
      const killerSkill = 800 // Low skill player
      const victimSkill = 1200 // High skill player
      const skillAdjustment = { killerChange: 45, victimChange: -15 } // Large adjustment for upset

      const killerStats = createMockPlayer(killerId, killerSkill)
      const victimStats = createMockPlayer(victimId, victimSkill)

      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)

      mockRankingService.calculateSkillAdjustment = vi.fn().mockResolvedValue(skillAdjustment)

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId,
          victimId,
          weapon: "deagle",
          headshot: true,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
        meta: {
          killer: { steamId: "STEAM_1:0:333333", playerName: "Underdog", isBot: false },
          victim: { steamId: "STEAM_1:0:444444", playerName: "Pro", isBot: false },
        },
      }

      await handler.handle(killEvent)

      expect(mockEventNotificationService.notifyKillEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          killerSkill: 845, // 800 + 45
          victimSkill: 1185, // 1200 - 15
        }),
      )
    })
  })

  describe("Basic Kill Event Handling", () => {
    it("should handle normal kill events successfully", async () => {
      const killerId = 1
      const victimId = 2
      const killerStats = createMockPlayer(killerId, 1050)
      const victimStats = createMockPlayer(victimId, 950)

      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)

      mockRankingService.calculateSkillAdjustment = vi.fn().mockResolvedValue({
        killerChange: 20,
        victimChange: -18,
      })

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId,
          victimId,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
        meta: {
          killer: { steamId: "STEAM_1:0:555555", playerName: "TestKiller", isBot: false },
          victim: { steamId: "STEAM_1:0:666666", playerName: "TestVictim", isBot: false },
        },
      }

      const result = await handler.handle(killEvent)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(2)
      expect(mockPlayerRepository.update).toHaveBeenCalledTimes(2)
      expect(mockEventNotificationService.notifyKillEvent).toHaveBeenCalled()
    })

    it("should handle headshot kills correctly", async () => {
      const killerId = 1
      const victimId = 2
      const killerStats = createMockPlayer(killerId)
      const victimStats = createMockPlayer(victimId)

      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)

      mockRankingService.calculateSkillAdjustment = vi.fn().mockResolvedValue({
        killerChange: 25, // Bonus for headshot
        victimChange: -20,
      })

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId,
          victimId,
          weapon: "ak47",
          headshot: true,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
        meta: {
          killer: { steamId: "STEAM_1:0:777777", playerName: "Headhunter", isBot: false },
          victim: { steamId: "STEAM_1:0:888888", playerName: "Target", isBot: false },
        },
      }

      await handler.handle(killEvent)

      expect(mockEventNotificationService.notifyKillEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          headshot: true,
          weapon: "ak47",
        }),
      )
    })
  })

  describe("Team Kill Handling", () => {
    it("should handle team kills correctly", async () => {
      const killerId = 1
      const victimId = 2
      const killerStats = createMockPlayer(killerId, 1100)
      const victimStats = createMockPlayer(victimId, 1000)

      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)

      // Team kills usually have penalties for both players
      mockRankingService.calculateSkillAdjustment = vi.fn().mockResolvedValue({
        killerChange: -30, // Penalty for team killer
        victimChange: -5, // Small penalty for victim
      })

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId,
          victimId,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "TERRORIST", // Same team = team kill
        },
      }

      const result = await handler.handle(killEvent)

      expect(result.success).toBe(true)

      // Should send correct post-adjustment values even for penalties
      expect(mockEventNotificationService.notifyKillEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          killerSkill: 1070, // 1100 - 30
          victimSkill: 995, // 1000 - 5
        }),
      )
    })
  })

  describe("Edge Cases and Error Handling", () => {
    it("should handle missing player stats gracefully", async () => {
      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 999, // Non-existent player
          victimId: 998, // Non-existent player
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      const result = await handler.handle(killEvent)

      // Should return success but with warning logged
      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Kill event skipped: missing player stats"),
      )
      expect(mockEventNotificationService.notifyKillEvent).not.toHaveBeenCalled()
    })

    it("should handle invalid event types", async () => {
      const invalidEvent = {
        eventType: EventType.PLAYER_SUICIDE, // Wrong type
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      } as unknown as PlayerKillEvent

      const result = await handler.handle(invalidEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid event type")
    })

    it("should handle notification service failures gracefully", async () => {
      const killerId = 1
      const victimId = 2
      const killerStats = createMockPlayer(killerId)
      const victimStats = createMockPlayer(victimId)

      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)

      mockRankingService.calculateSkillAdjustment = vi.fn().mockResolvedValue({
        killerChange: 20,
        victimChange: -18,
      })

      // Make notification service fail
      mockEventNotificationService.notifyKillEvent = vi
        .fn()
        .mockRejectedValue(new Error("Notification service unavailable"))

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId,
          victimId,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      const result = await handler.handle(killEvent)

      // Should still succeed - notification failures shouldn't fail the event
      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send kill event notification"),
        expect.any(Object),
      )
    })

    it("should handle database failures during stat updates", async () => {
      const killerId = 1
      const victimId = 2
      const killerStats = createMockPlayer(killerId)
      const victimStats = createMockPlayer(victimId)

      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)

      mockRankingService.calculateSkillAdjustment = vi.fn().mockResolvedValue({
        killerChange: 20,
        victimChange: -18,
      })

      // Make database update fail
      mockPlayerRepository.update = vi
        .fn()
        .mockRejectedValue(new Error("Database connection failed"))

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId,
          victimId,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      const result = await handler.handle(killEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Database connection failed")
    })
  })

  describe("Skill Calculation Integration", () => {
    it("should pass correct parameters to ranking service", async () => {
      const killerId = 1
      const victimId = 2
      const killerStats = createMockPlayer(killerId, 1200)
      const victimStats = createMockPlayer(victimId, 800)

      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)

      mockRankingService.calculateSkillAdjustment = vi.fn().mockResolvedValue({
        killerChange: 15,
        victimChange: -20,
      })

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId,
          victimId,
          weapon: "awp",
          headshot: true,
          killerTeam: "CT",
          victimTeam: "TERRORIST",
        },
      }

      await handler.handle(killEvent)

      // Verify ranking service was called with correct parameters
      expect(mockRankingService.calculateSkillAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: killerId,
          rating: 1200,
          gamesPlayed: killerStats.kills + killerStats.deaths,
        }),
        expect.objectContaining({
          playerId: victimId,
          rating: 800,
          gamesPlayed: victimStats.kills + victimStats.deaths,
        }),
        expect.objectContaining({
          weapon: "awp",
          headshot: true,
          killerTeam: "CT",
          victimTeam: "TERRORIST",
        }),
      )
    })
  })

  describe("Match Service Integration", () => {
    it("should update match teams when provided", async () => {
      const killerId = 1
      const victimId = 2
      const serverId = 1
      const killerStats = createMockPlayer(killerId)
      const victimStats = createMockPlayer(victimId)

      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)

      mockRankingService.calculateSkillAdjustment = vi.fn().mockResolvedValue({
        killerChange: 20,
        victimChange: -18,
      })

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId,
        timestamp: new Date(),
        data: {
          killerId,
          victimId,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      await handler.handle(killEvent)

      expect(mockMatchService.setPlayerTeam).toHaveBeenCalledWith(serverId, killerId, "TERRORIST")
      expect(mockMatchService.setPlayerTeam).toHaveBeenCalledWith(serverId, victimId, "CT")
    })
  })

  describe("Event Logging", () => {
    it("should log event frag with correct parameters", async () => {
      const killerId = 1
      const victimId = 2
      const serverId = 1
      const killerStats = createMockPlayer(killerId)
      const victimStats = createMockPlayer(victimId)

      mockPlayerRepository.getPlayerStats = vi
        .fn()
        .mockResolvedValueOnce(killerStats)
        .mockResolvedValueOnce(victimStats)

      mockRankingService.calculateSkillAdjustment = vi.fn().mockResolvedValue({
        killerChange: 20,
        victimChange: -18,
      })

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId,
        timestamp: new Date(),
        data: {
          killerId,
          victimId,
          weapon: "ak47",
          headshot: true,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      await handler.handle(killEvent)

      expect(mockPlayerRepository.logEventFrag).toHaveBeenCalledWith(
        killerId,
        victimId,
        serverId,
        "de_dust2",
        "ak47",
        true,
        undefined, // killerRole
        undefined, // victimRole
        undefined, // killerX
        undefined, // killerY
        undefined, // killerZ
        undefined, // victimX
        undefined, // victimY
        undefined, // victimZ
      )
    })
  })
})
