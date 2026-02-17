/**
 * Event Notification Service Tests
 */

import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { INotificationConfigRepository } from "../repositories/notification-config.repository"
import type {
  ActionEventNotificationData,
  ConnectEventNotificationData,
  DisconnectEventNotificationData,
  KillEventNotificationData,
  SuicideEventNotificationData,
  TeamActionEventNotificationData,
  TeamKillEventNotificationData,
} from "../types/notification.types"
import type { CommandResolverService } from "./command-resolver.service"
import { EventNotificationService } from "./event-notification.service"
import type { PlayerNotificationService } from "./player-notification.service"

describe("EventNotificationService", () => {
  let service: EventNotificationService
  let mockLogger: ILogger
  let mockConfigRepository: INotificationConfigRepository
  let mockPlayerNotificationService: PlayerNotificationService
  let mockCommandResolver: CommandResolverService

  beforeEach(() => {
    vi.clearAllMocks()

    mockLogger = createMockLogger()

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

    mockCommandResolver = {
      getCommand: vi.fn().mockResolvedValue("hlx_event"),
      getCommandCapabilities: vi.fn().mockResolvedValue({
        supportsBatch: false,
        maxBatchSize: 1,
        requiresHashPrefix: false,
      }),
      supportsBatch: vi.fn().mockResolvedValue(false),
      getBatchLimit: vi.fn().mockResolvedValue(1),
      clearCache: vi.fn(),
      clearServerCache: vi.fn(),
    } as unknown as CommandResolverService

    service = new EventNotificationService(
      mockPlayerNotificationService,
      mockConfigRepository,
      mockCommandResolver,
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

    it("should stringify non-Error objects in error handling", async () => {
      mockConfigRepository.isEventTypeEnabled = vi.fn().mockRejectedValue("string error")

      const result = await service.isEventTypeEnabled(1, EventType.PLAYER_KILL)

      expect(result).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to check if event type is enabled, defaulting to true",
        expect.objectContaining({
          error: "string error",
        }),
      )
    })
  })

  describe("notifyTeamActionEvent", () => {
    it("should send structured team action command when event is enabled", async () => {
      const teamActionData: TeamActionEventNotificationData = {
        serverId: 1,
        team: "CT",
        actionCode: "bomb_defused",
        actionDescription: "Defused the bomb",
        points: 3,
        playerCount: 5,
      }

      await service.notifyTeamActionEvent(teamActionData)

      expect(mockPlayerNotificationService.executeRawCommand).toHaveBeenCalledWith(
        1,
        'hlx_event 0 TEAM_ACTION "CT" "bomb_defused" "Defused the bomb" 3 5',
      )
    })

    it("should not send notification when team action event is disabled", async () => {
      mockConfigRepository.isEventTypeEnabled = vi.fn().mockResolvedValue(false)

      const teamActionData: TeamActionEventNotificationData = {
        serverId: 1,
        team: "CT",
        actionCode: "bomb_defused",
        actionDescription: "Defused the bomb",
        points: 3,
      }

      await service.notifyTeamActionEvent(teamActionData)

      expect(mockPlayerNotificationService.executeRawCommand).not.toHaveBeenCalled()
    })

    it("should handle error and log it", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(
        new Error("RCON failed"),
      )

      const teamActionData: TeamActionEventNotificationData = {
        serverId: 1,
        team: "T",
        actionCode: "hostage_killed",
        actionDescription: "Killed hostage",
        points: -2,
      }

      // Should not throw (catch block)
      await service.notifyTeamActionEvent(teamActionData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send team action notification"),
        expect.objectContaining({
          serverId: 1,
          team: "T",
          action: "hostage_killed",
          error: "RCON failed",
        }),
      )
    })

    it("should stringify non-Error objects in error handling", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(42)

      const teamActionData: TeamActionEventNotificationData = {
        serverId: 1,
        team: "T",
        actionCode: "test",
        actionDescription: "test",
        points: 0,
      }

      await service.notifyTeamActionEvent(teamActionData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "42" }),
      )
    })
  })

  describe("notifyConnectEvent", () => {
    it("should send structured connect command when event is enabled", async () => {
      const connectData: ConnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "NewPlayer",
        playerCountry: "US",
        ipAddress: "192.168.1.1",
        connectionTime: 0,
      }

      await service.notifyConnectEvent(connectData)

      expect(mockPlayerNotificationService.executeRawCommand).toHaveBeenCalledWith(
        1,
        'hlx_event 0 CONNECT 5 "NewPlayer" "US"',
      )
    })

    it("should not send notification when connect event is disabled", async () => {
      mockConfigRepository.isEventTypeEnabled = vi.fn().mockResolvedValue(false)

      const connectData: ConnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        ipAddress: "127.0.0.1",
        connectionTime: 0,
      }

      await service.notifyConnectEvent(connectData)

      expect(mockPlayerNotificationService.executeRawCommand).not.toHaveBeenCalled()
    })

    it("should handle error and log it", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(
        new Error("Connect notify failed"),
      )

      const connectData: ConnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        ipAddress: "127.0.0.1",
        connectionTime: 0,
      }

      await service.notifyConnectEvent(connectData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send connect notification"),
        expect.objectContaining({
          serverId: 1,
          playerId: 5,
          error: "Connect notify failed",
        }),
      )
    })

    it("should stringify non-Error objects in error handling", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce("timeout")

      const connectData: ConnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        ipAddress: "127.0.0.1",
        connectionTime: 0,
      }

      await service.notifyConnectEvent(connectData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "timeout" }),
      )
    })
  })

  describe("notifyDisconnectEvent", () => {
    it("should send structured disconnect command when event is enabled", async () => {
      const disconnectData: DisconnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "LeavingPlayer",
        reason: "Disconnected",
        sessionDuration: 3600,
      }

      await service.notifyDisconnectEvent(disconnectData)

      expect(mockPlayerNotificationService.executeRawCommand).toHaveBeenCalledWith(
        1,
        'hlx_event 0 DISCONNECT 5 "LeavingPlayer" 3600',
      )
    })

    it("should not send notification when disconnect event is disabled", async () => {
      mockConfigRepository.isEventTypeEnabled = vi.fn().mockResolvedValue(false)

      const disconnectData: DisconnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        reason: "Left",
        sessionDuration: 100,
      }

      await service.notifyDisconnectEvent(disconnectData)

      expect(mockPlayerNotificationService.executeRawCommand).not.toHaveBeenCalled()
    })

    it("should handle error and log it", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(
        new Error("Disconnect notify failed"),
      )

      const disconnectData: DisconnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        reason: "Timed out",
        sessionDuration: 500,
      }

      await service.notifyDisconnectEvent(disconnectData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send disconnect notification"),
        expect.objectContaining({
          serverId: 1,
          playerId: 5,
          error: "Disconnect notify failed",
        }),
      )
    })

    it("should stringify non-Error objects in error handling", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(null)

      const disconnectData: DisconnectEventNotificationData = {
        serverId: 1,
        playerId: 5,
        playerName: "Player",
        reason: "Left",
        sessionDuration: 0,
      }

      await service.notifyDisconnectEvent(disconnectData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "null" }),
      )
    })
  })

  describe("notifyKillEvent error handling", () => {
    it("should handle error in notifyKillEvent and not throw", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(
        new Error("Kill notify failed"),
      )

      const killData: KillEventNotificationData = {
        serverId: 1,
        killerId: 1,
        victimId: 2,
        skillAdjustment: { killerChange: 5, victimChange: -5 },
      }

      await service.notifyKillEvent(killData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send kill notification"),
        expect.objectContaining({
          serverId: 1,
          killerId: 1,
          victimId: 2,
          error: "Kill notify failed",
        }),
      )
    })

    it("should stringify non-Error objects in kill event error handling", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce("oops")

      const killData: KillEventNotificationData = {
        serverId: 1,
        killerId: 1,
        victimId: 2,
        skillAdjustment: { killerChange: 5, victimChange: -5 },
      }

      await service.notifyKillEvent(killData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "oops" }),
      )
    })
  })

  describe("notifySuicideEvent error handling", () => {
    it("should handle error in notifySuicideEvent and not throw", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(
        new Error("Suicide notify failed"),
      )

      const suicideData: SuicideEventNotificationData = {
        serverId: 1,
        playerId: 5,
        skillPenalty: 3,
      }

      await service.notifySuicideEvent(suicideData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send suicide notification"),
        expect.objectContaining({
          serverId: 1,
          playerId: 5,
          error: "Suicide notify failed",
        }),
      )
    })

    it("should stringify non-Error objects in suicide event error handling", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(999)

      const suicideData: SuicideEventNotificationData = {
        serverId: 1,
        playerId: 5,
        skillPenalty: 3,
      }

      await service.notifySuicideEvent(suicideData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "999" }),
      )
    })
  })

  describe("notifyTeamKillEvent error handling", () => {
    it("should not send notification when team kill event is disabled", async () => {
      mockConfigRepository.isEventTypeEnabled = vi.fn().mockResolvedValue(false)

      const teamKillData: TeamKillEventNotificationData = {
        serverId: 1,
        killerId: 5,
        victimId: 10,
        weapon: "knife",
        headshot: false,
        skillPenalty: 5,
      }

      await service.notifyTeamKillEvent(teamKillData)

      expect(mockPlayerNotificationService.executeRawCommand).not.toHaveBeenCalled()
    })

    it("should handle error in notifyTeamKillEvent and not throw", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(
        new Error("TK notify failed"),
      )

      const teamKillData: TeamKillEventNotificationData = {
        serverId: 1,
        killerId: 5,
        victimId: 10,
        weapon: "knife",
        headshot: false,
        skillPenalty: 5,
      }

      await service.notifyTeamKillEvent(teamKillData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send team kill notification"),
        expect.objectContaining({
          serverId: 1,
          killerId: 5,
          victimId: 10,
          error: "TK notify failed",
        }),
      )
    })

    it("should stringify non-Error objects in team kill event error handling", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(false)

      const teamKillData: TeamKillEventNotificationData = {
        serverId: 1,
        killerId: 5,
        victimId: 10,
        weapon: "knife",
        headshot: false,
        skillPenalty: 5,
      }

      await service.notifyTeamKillEvent(teamKillData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "false" }),
      )
    })
  })

  describe("notifyActionEvent error handling", () => {
    it("should handle error in notifyActionEvent and not throw", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(
        new Error("Action notify failed"),
      )

      const actionData: ActionEventNotificationData = {
        serverId: 1,
        playerId: 5,
        actionCode: "test",
        actionDescription: "test action",
        points: 1,
      }

      await service.notifyActionEvent(actionData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send action notification"),
        expect.objectContaining({
          serverId: 1,
          playerId: 5,
          action: "test",
          error: "Action notify failed",
        }),
      )
    })

    it("should stringify non-Error objects in action event error handling", async () => {
      vi.mocked(mockPlayerNotificationService.executeRawCommand).mockRejectedValueOnce(undefined)

      const actionData: ActionEventNotificationData = {
        serverId: 1,
        playerId: 5,
        actionCode: "test",
        actionDescription: "test",
        points: 1,
      }

      await service.notifyActionEvent(actionData)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "undefined" }),
      )
    })
  })
})
