/**
 * Event Notification Service Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { EventNotificationService } from "./event-notification.service"
import type { KillEventNotificationData } from "../types/notification.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IServerService } from "@/modules/server/server.types"
import type { INotificationConfigRepository } from "../repositories/notification-config.repository"
import type { PlayerNotificationService } from "./player-notification.service"
import { createMockLogger } from "../../../tests/mocks/logger"

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
    it("should process kill event with rank information", async () => {
      const killData: KillEventNotificationData = {
        serverId: 1,
        killerId: 1,
        victimId: 2,
        killerName: "Player1",
        victimName: "Player2",
        weapon: "ak47",
        headshot: true,
        skillAdjustment: {
          killerChange: 5,
          victimChange: -3,
        },
        timestamp: new Date(),
      }

      await service.notifyKillEvent(killData)

      expect(mockRankingService.getBatchPlayerRanks).toHaveBeenCalledWith([1, 2])
      expect(mockServerService.findById).toHaveBeenCalledWith(1)
      expect(mockConfigRepository.getConfigWithDefaults).toHaveBeenCalledWith(1, "goldsrc")
      expect(mockPlayerNotificationService.broadcastAnnouncement).toHaveBeenCalledWith(
        1,
        expect.stringContaining("Player1"),
        expect.any(String),
      )
    })

    it("should handle missing killer/victim names", async () => {
      const killData: KillEventNotificationData = {
        serverId: 1,
        killerId: 1,
        victimId: 2,
        weapon: "ak47",
        headshot: false,
        skillAdjustment: {
          killerChange: 3,
          victimChange: -2,
        },
        timestamp: new Date(),
      }

      await service.notifyKillEvent(killData)

      expect(mockPlayerNotificationService.broadcastAnnouncement).toHaveBeenCalled()
    })

    it("should handle service errors gracefully", async () => {
      ;(mockRankingService.getBatchPlayerRanks as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Ranking service error"),
      )

      const killData: KillEventNotificationData = {
        serverId: 1,
        killerId: 1,
        victimId: 2,
        killerName: "Player1",
        victimName: "Player2",
        weapon: "ak47",
        headshot: false,
        skillAdjustment: {
          killerChange: 3,
          victimChange: -2,
        },
        timestamp: new Date(),
      }

      // Should not throw but handle gracefully
      await expect(service.notifyKillEvent(killData)).resolves.toBeUndefined()
      expect(mockPlayerNotificationService.broadcastAnnouncement).toHaveBeenCalled()
    })
  })

  describe("notifyTeamKillEvent", () => {
    it("should process team kill event", async () => {
      const teamKillData = {
        serverId: 1,
        killerId: 1,
        victimId: 2,
        killerName: "Player1",
        victimName: "Player2",
        weapon: "ak47",
        headshot: false,
        skillPenalty: -5,
        timestamp: new Date(),
      }

      await service.notifyTeamKillEvent(teamKillData)

      expect(mockServerService.findById).toHaveBeenCalledWith(1)
      expect(mockConfigRepository.getConfigWithDefaults).toHaveBeenCalledWith(1, "goldsrc")
      expect(mockPlayerNotificationService.broadcastAnnouncement).toHaveBeenCalled()
    })
  })

  describe("notifySuicideEvent", () => {
    it("should process suicide event", async () => {
      const suicideData = {
        serverId: 1,
        playerId: 1,
        playerName: "Player1",
        weapon: "grenade",
        skillPenalty: -5,
        timestamp: new Date(),
      }

      await service.notifySuicideEvent(suicideData)

      expect(mockRankingService.getPlayerRankPosition).toHaveBeenCalledWith(1)
      expect(mockPlayerNotificationService.broadcastAnnouncement).toHaveBeenCalled()
    })
  })

  describe("notifyActionEvent", () => {
    it("should process action event", async () => {
      const actionData = {
        serverId: 1,
        playerId: 1,
        playerName: "Player1",
        actionCode: "plant_bomb",
        actionDescription: "Plant the Bomb",
        points: 3,
        skillAdjustment: 3,
        timestamp: new Date(),
      }

      await service.notifyActionEvent(actionData)

      expect(mockPlayerNotificationService.broadcastAnnouncement).toHaveBeenCalled()
    })
  })

  describe("notifyTeamActionEvent", () => {
    it("should process team action event", async () => {
      const teamActionData = {
        serverId: 1,
        team: "TERRORIST",
        actionCode: "plant_bomb",
        actionDescription: "Plant the Bomb",
        points: 2,
        skillAdjustment: 2,
        timestamp: new Date(),
      }

      await service.notifyTeamActionEvent(teamActionData)

      expect(mockPlayerNotificationService.broadcastAnnouncement).toHaveBeenCalled()
    })
  })

  describe("notifyConnectEvent", () => {
    it("should process connect event", async () => {
      const connectData = {
        serverId: 1,
        playerId: 1,
        playerName: "Player1",
        steamId: "STEAM_0:1:12345",
        ipAddress: "127.0.0.1",
        connectionTime: 300,
        timestamp: new Date(),
      }

      await service.notifyConnectEvent(connectData)

      expect(mockPlayerNotificationService.broadcastAnnouncement).toHaveBeenCalled()
    })
  })

  describe("notifyDisconnectEvent", () => {
    it("should process disconnect event", async () => {
      const disconnectData = {
        serverId: 1,
        playerId: 1,
        playerName: "Player1",
        reason: "Disconnect",
        sessionDuration: 1800,
        timestamp: new Date(),
      }

      await service.notifyDisconnectEvent(disconnectData)

      expect(mockPlayerNotificationService.broadcastAnnouncement).toHaveBeenCalled()
    })
  })

  describe("private methods", () => {
    describe("determineEngineType", () => {
      it("should map common game codes correctly", () => {
        // Access private method for testing
        const service_ = service as unknown as {
          determineEngineType: (game: string) => string
        }

        expect(service_.determineEngineType("cstrike")).toBe("goldsrc")
        expect(service_.determineEngineType("css")).toBe("source")
        expect(service_.determineEngineType("csgo")).toBe("source")
        expect(service_.determineEngineType("cs2")).toBe("source2")
        expect(service_.determineEngineType("unknown")).toBe("goldsrc")
      })
    })

    describe("validateEngineType", () => {
      it("should validate engine types correctly", () => {
        const service_ = service as unknown as {
          validateEngineType: (engineType: string) => string
        }

        expect(service_.validateEngineType("goldsrc")).toBe("goldsrc")
        expect(service_.validateEngineType("source")).toBe("source")
        expect(service_.validateEngineType("source2")).toBe("source2")
        expect(service_.validateEngineType("invalid")).toBe("goldsrc")
      })
    })

    describe("parseMessageFormats", () => {
      it("should parse valid message formats", () => {
        const service_ = service as unknown as {
          parseMessageFormats: (messageFormats: unknown) => Record<string, unknown>
        }
        const formats = { kill: "Custom kill message" }

        const result = service_.parseMessageFormats(formats)
        expect(result).toEqual(formats)
      })

      it("should return empty object for invalid formats", () => {
        const service_ = service as unknown as {
          parseMessageFormats: (messageFormats: unknown) => Record<string, unknown>
        }

        expect(service_.parseMessageFormats(null)).toEqual({})
        expect(service_.parseMessageFormats("string")).toEqual({})
        expect(service_.parseMessageFormats(123)).toEqual({})
      })
    })
  })

  describe("cache management", () => {
    it("should clear rank cache", () => {
      service.clearRankCache()
      // No assertion needed as this is a void method
    })
  })
})
