/**
 * Event Notification Service Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { EventNotificationService } from "./event-notification.service"
import type {
  KillEventNotificationData,
  SuicideEventNotificationData,
  TeamKillEventNotificationData,
  ActionEventNotificationData,
} from "../types/notification.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IServerService } from "@/modules/server/server.types"
import type { INotificationConfigRepository } from "../repositories/notification-config.repository"
import type { PlayerNotificationService } from "./player-notification.service"
import { createMockLogger } from "../../../tests/mocks/logger"
import { EventType } from "@/shared/types/events"

describe("EventNotificationService", () => {
  let service: EventNotificationService
  let mockLogger: ILogger
  let mockRankingService: IRankingService
  let mockServerService: IServerService
  let mockConfigRepository: INotificationConfigRepository
  let mockPlayerNotificationService: PlayerNotificationService

  beforeEach(() => {
    mockLogger = createMockLogger()

    mockRankingService = {
      calculateRatingAdjustment: vi.fn().mockResolvedValue({ winner: 10, loser: -8 }),
      calculateSkillAdjustment: vi.fn().mockResolvedValue({ killerChange: 10, victimChange: -8 }),
      calculateSuicidePenalty: vi.fn().mockReturnValue(-5),
      calculateTeamkillPenalty: vi.fn().mockReturnValue(-10),
      getPlayerRankPosition: vi.fn().mockResolvedValue(1),
      getBatchPlayerRanks: vi.fn().mockResolvedValue(
        new Map([
          [1, 1],
          [2, 2],
        ]),
      ),
    }

    mockServerService = {
      getServer: vi.fn(),
      getServerByAddress: vi.fn(),
      getServerGame: vi.fn(),
      getServerConfigBoolean: vi.fn(),
      findById: vi.fn().mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "127.0.0.1",
        port: 27015,
      }),
    } as unknown as IServerService

    mockConfigRepository = {
      getConfig: vi.fn(),
      upsertConfig: vi.fn(),
      deleteConfig: vi.fn(),
      isEventTypeEnabled: vi.fn().mockResolvedValue(true),
      clearCache: vi.fn(),
      clearServerCache: vi.fn(),
      getConfigWithDefaults: vi.fn().mockResolvedValue({
        serverId: 1,
        engineType: "goldsrc",
        colorEnabled: true,
        colorScheme: null,
        eventTypes: null,
        messageFormats: null,
      }),
    }

    mockPlayerNotificationService = {
      broadcastAnnouncement: vi.fn().mockResolvedValue(undefined),
      executeRawCommand: vi.fn().mockResolvedValue(undefined),
      notifyPlayer: vi.fn().mockResolvedValue(undefined),
      notifyMultiplePlayers: vi.fn().mockResolvedValue(undefined),
      supportsPrivateMessaging: vi.fn().mockResolvedValue(true),
    } as unknown as PlayerNotificationService

    service = new EventNotificationService(
      mockPlayerNotificationService,
      mockConfigRepository,
      mockRankingService,
      mockServerService,
      mockLogger,
    )
  })

  describe("notifyKillEvent", () => {
    it("should send structured kill command when event is enabled", async () => {
      const killData: KillEventNotificationData = {
        serverId: 1,
        killerId: 1,
        victimId: 2,
        killerName: "Player1",
        victimName: "Player2",
        killerSkill: 1500,
        victimSkill: 1450,
        weapon: "ak47",
        headshot: true,
        skillAdjustment: {
          killerChange: 5,
          victimChange: -3,
        },
        timestamp: new Date(),
      }

      await service.notifyKillEvent(killData)

      expect(mockPlayerNotificationService.executeRawCommand).toHaveBeenCalledWith(
        1,
        'hlx_event 0 KILL 1 "Player1" 1500 2 "Player2" 1450 5 ak47 1',
      )
    })

    it("should not send notification when event is disabled", async () => {
      mockConfigRepository.isEventTypeEnabled = vi.fn().mockResolvedValue(false)

      const killData: KillEventNotificationData = {
        serverId: 1,
        killerId: 1,
        victimId: 2,
        skillAdjustment: {
          killerChange: 5,
          victimChange: -3,
        },
      }

      await service.notifyKillEvent(killData)

      expect(mockPlayerNotificationService.executeRawCommand).not.toHaveBeenCalled()
    })

    it("should handle kill events with missing player names", async () => {
      const killData: KillEventNotificationData = {
        serverId: 1,
        killerId: 5,
        victimId: 10,
        skillAdjustment: {
          killerChange: 10,
          victimChange: -10,
        },
        weapon: "unknown",
        headshot: false,
      }

      await service.notifyKillEvent(killData)

      expect(mockPlayerNotificationService.executeRawCommand).toHaveBeenCalledWith(
        1,
        'hlx_event 0 KILL 5 "" 0 10 "" 0 10 unknown 0',
      )
    })
  })

  describe("notifySuicideEvent", () => {
    it("should send structured suicide command", async () => {
      const suicideData: SuicideEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "DepressedPlayer",
        playerSkill: 1500,
        skillPenalty: 5,
      }

      await service.notifySuicideEvent(suicideData)

      expect(mockPlayerNotificationService.executeRawCommand).toHaveBeenCalledWith(
        1,
        'hlx_event 0 SUICIDE 5 "DepressedPlayer" 1500 5',
      )
    })

    it("should not send notification when event is disabled", async () => {
      mockConfigRepository.isEventTypeEnabled = vi.fn().mockResolvedValue(false)

      const suicideData: SuicideEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        playerSkill: 1000,
        skillPenalty: 2,
      }

      await service.notifySuicideEvent(suicideData)

      expect(mockPlayerNotificationService.executeRawCommand).not.toHaveBeenCalled()
    })
  })

  describe("notifyTeamKillEvent", () => {
    it("should send structured teamkill command", async () => {
      const teamKillData: TeamKillEventNotificationData = {
        serverId: 1,
        killerId: 5,
        victimId: 10,
        killerName: "TeamKiller",
        victimName: "TeamMate",
        weapon: "m4a1",
        headshot: false,
        skillPenalty: 10,
      }

      await service.notifyTeamKillEvent(teamKillData)

      expect(mockPlayerNotificationService.executeRawCommand).toHaveBeenCalledWith(
        1,
        'hlx_event 0 TEAMKILL 5 "TeamKiller" 10 "TeamMate" 10',
      )
    })
  })

  describe("notifyActionEvent", () => {
    it("should send structured action command", async () => {
      const actionData: ActionEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Bomber",
        playerSkill: 1500,
        actionCode: "bomb_planted",
        actionDescription: "Planted the bomb",
        points: 5,
      }

      await service.notifyActionEvent(actionData)

      expect(mockPlayerNotificationService.executeRawCommand).toHaveBeenCalledWith(
        1,
        'hlx_event 0 ACTION 5 "Bomber" 1500 "bomb_planted" "Planted the bomb" 5',
      )
    })

    it("should not send notification when event is disabled", async () => {
      mockConfigRepository.isEventTypeEnabled = vi.fn().mockResolvedValue(false)

      const actionData: ActionEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        actionCode: "action",
        actionDescription: "Did something",
        points: 1,
      }

      await service.notifyActionEvent(actionData)

      expect(mockPlayerNotificationService.executeRawCommand).not.toHaveBeenCalled()
    })
  })

  describe("isEventTypeEnabled", () => {
    it("should return true when event type is enabled", async () => {
      mockConfigRepository.isEventTypeEnabled = vi.fn().mockResolvedValue(true)

      const result = await service.isEventTypeEnabled(1, EventType.PLAYER_KILL)

      expect(result).toBe(true)
      expect(mockConfigRepository.isEventTypeEnabled).toHaveBeenCalledWith(1, EventType.PLAYER_KILL)
    })

    it("should return false when event type is disabled", async () => {
      mockConfigRepository.isEventTypeEnabled = vi.fn().mockResolvedValue(false)

      const result = await service.isEventTypeEnabled(1, EventType.PLAYER_SUICIDE)

      expect(result).toBe(false)
    })

    it("should return true on error and log warning", async () => {
      mockConfigRepository.isEventTypeEnabled = vi.fn().mockRejectedValue(new Error("DB Error"))

      const result = await service.isEventTypeEnabled(1, EventType.PLAYER_KILL)

      expect(result).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to check if event type is enabled, defaulting to true",
        expect.objectContaining({
          serverId: 1,
          eventType: EventType.PLAYER_KILL,
          error: "DB Error",
        }),
      )
    })
  })
})
