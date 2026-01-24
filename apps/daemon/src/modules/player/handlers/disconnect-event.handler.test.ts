/**
 * Disconnect Event Handler Tests
 *
 * Tests for player disconnection event handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { DisconnectEventHandler } from "./disconnect-event.handler"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import { createMockSessionService } from "@/tests/mocks/session.service.mock"
import { createMockServerRepository } from "@/tests/mocks/server.repository.mock"
import { createMockMatchService } from "@/tests/mocks/match.service.mock"
import type { IPlayerRepository, PlayerDisconnectEvent } from "@/modules/player/types/player.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IServerRepository } from "@/modules/server/server.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IMapService } from "@/modules/map/map.service"
import type { IEventNotificationService } from "@/modules/rcon/services/event-notification.service"

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

describe("DisconnectEventHandler", () => {
  let handler: DisconnectEventHandler
  let mockRepository: IPlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockSessionService: IPlayerSessionService
  let mockServerRepository: IServerRepository
  let mockMatchService: IMatchService
  let mockMapService: IMapService
  let mockNotificationService: IEventNotificationService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockPlayerRepository()
    mockSessionService = createMockSessionService()
    mockServerRepository = createMockServerRepository()
    mockMatchService = createMockMatchService()
    mockMapService = createMockMapService()
    mockNotificationService = createMockEventNotificationService()

    handler = new DisconnectEventHandler(
      mockRepository,
      mockLogger,
      mockSessionService,
      mockServerRepository,
      mockMatchService,
      mockMapService,
      mockNotificationService,
    )
  })

  describe("handle", () => {
    it("should handle disconnect with valid session", async () => {
      const connectedAt = new Date(Date.now() - 3600000) // 1 hour ago
      vi.mocked(mockSessionService.getSessionByGameUserId).mockResolvedValue({
        serverId: 1,
        gameUserId: 10,
        databasePlayerId: 100,
        playerName: "TestPlayer",
        steamId: "STEAM_0:1:123456",
        isBot: false,
        connectedAt,
        lastSeen: new Date(),
      })

      const event: PlayerDisconnectEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          playerId: 100,
          reason: "Disconnect by user",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockSessionService.removeSession).toHaveBeenCalledWith(1, 10)
      expect(mockRepository.update).toHaveBeenCalled()
      expect(mockRepository.createDisconnectEvent).toHaveBeenCalled()
    })

    it("should handle disconnect without session using playerId", async () => {
      vi.mocked(mockSessionService.getSessionByGameUserId).mockResolvedValue(null)

      const event: PlayerDisconnectEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: -1,
          playerId: 100,
        },
        meta: {
          playerName: "BotPlayer",
          steamId: "",
          isBot: true,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockRepository.update).toHaveBeenCalled()
    })

    it("should skip processing when no valid playerId", async () => {
      vi.mocked(mockSessionService.getSessionByGameUserId).mockResolvedValue(null)
      vi.mocked(mockServerRepository.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "192.168.1.1",
        port: 27015,
      })
      vi.mocked(mockRepository.findByUniqueId).mockResolvedValue(null)

      const event: PlayerDisconnectEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: -1,
          playerId: -1,
        },
        meta: {
          playerName: "UnknownPlayer",
          steamId: "",
          isBot: false,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("skipping disconnect processing"),
      )
    })

    it("should resolve bot disconnect by name", async () => {
      vi.mocked(mockSessionService.getSessionByGameUserId).mockResolvedValue(null)
      vi.mocked(mockServerRepository.findById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
        name: "Test Server",
        address: "192.168.1.1",
        port: 27015,
      })
      vi.mocked(mockRepository.findByUniqueId).mockResolvedValue({
        playerId: 500,
        lastName: "Bot Expert",
        game: "cstrike",
        skill: 1000,
      } as any)

      const event: PlayerDisconnectEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: -1,
          playerId: -1,
        },
        meta: {
          playerName: "Expert",
          steamId: "",
          isBot: true,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Resolved bot Expert to playerId 500"),
      )
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

    it("should send disconnect notification", async () => {
      const connectedAt = new Date(Date.now() - 1800000) // 30 mins ago
      vi.mocked(mockSessionService.getSessionByGameUserId).mockResolvedValue({
        serverId: 1,
        gameUserId: 10,
        databasePlayerId: 100,
        playerName: "TestPlayer",
        steamId: "STEAM_0:1:123456",
        isBot: false,
        connectedAt,
        lastSeen: new Date(),
      })

      vi.mocked(mockRepository.getPlayerStats).mockResolvedValue({
        playerId: 100,
        skill: 1150,
      } as any)

      vi.mocked(mockRepository.findById).mockResolvedValue({
        playerId: 100,
        country: "US",
      } as any)

      const event: PlayerDisconnectEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          playerId: 100,
          reason: "Kicked by console",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      expect(mockNotificationService.notifyDisconnectEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 1,
          playerId: 100,
          playerName: "TestPlayer",
          playerCountry: "US",
          reason: "Kicked by console",
        }),
      )
    })

    it("should handle notification service error gracefully", async () => {
      const connectedAt = new Date(Date.now() - 60000)
      vi.mocked(mockSessionService.getSessionByGameUserId).mockResolvedValue({
        serverId: 1,
        gameUserId: 10,
        databasePlayerId: 100,
        playerName: "TestPlayer",
        steamId: "STEAM_0:1:123456",
        isBot: false,
        connectedAt,
        lastSeen: new Date(),
      })

      vi.mocked(mockNotificationService.notifyDisconnectEvent).mockRejectedValue(
        new Error("Notification failed"),
      )

      const event: PlayerDisconnectEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          playerId: 100,
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
        expect.stringContaining("Failed to send disconnect notification"),
      )
    })

    it("should clean up mismatched session by Steam ID", async () => {
      vi.mocked(mockSessionService.getSessionByGameUserId).mockResolvedValue(null)
      vi.mocked(mockSessionService.getSessionBySteamId).mockResolvedValue({
        serverId: 1,
        gameUserId: 99, // Different game user ID
        databasePlayerId: 100,
        playerName: "TestPlayer",
        steamId: "STEAM_0:1:123456",
        isBot: false,
        connectedAt: new Date(),
        lastSeen: new Date(),
      })

      const event: PlayerDisconnectEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          playerId: 100,
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      expect(mockSessionService.removeSession).toHaveBeenCalledWith(1, 99)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Cleaned up mismatched session"),
      )
    })
  })
})
