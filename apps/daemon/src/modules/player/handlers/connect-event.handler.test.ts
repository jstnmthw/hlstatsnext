/**
 * Connect Event Handler Tests
 *
 * Tests for player connection event handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { ConnectEventHandler } from "./connect-event.handler"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import { createMockSessionService } from "@/tests/mocks/session.service.mock"
import { createMockServerService } from "@/tests/mocks/server.service.mock"
import { createMockMatchService } from "@/tests/mocks/match.service.mock"
import type { IPlayerRepository, PlayerConnectEvent } from "@/modules/player/types/player.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IServerService } from "@/modules/server/server.types"
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

interface MockGeoipService {
  lookup(ipWithPort: string): Promise<unknown>
}

function createMockGeoipService(): MockGeoipService {
  return {
    lookup: vi.fn().mockResolvedValue(null),
  }
}

describe("ConnectEventHandler", () => {
  let handler: ConnectEventHandler
  let mockRepository: IPlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockSessionService: IPlayerSessionService
  let mockServerService: IServerService
  let mockMatchService: IMatchService
  let mockMapService: IMapService
  let mockNotificationService: IEventNotificationService
  let mockGeoipService: MockGeoipService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockPlayerRepository()
    mockSessionService = createMockSessionService()
    mockServerService = createMockServerService()
    mockMatchService = createMockMatchService()
    mockMapService = createMockMapService()
    mockNotificationService = createMockNotificationService()
    mockGeoipService = createMockGeoipService()

    handler = new ConnectEventHandler(
      mockRepository,
      mockLogger,
      mockSessionService,
      mockServerService,
      mockMatchService,
      mockMapService,
      mockGeoipService,
      mockNotificationService,
    )
  })

  describe("handle", () => {
    it("should process valid PLAYER_CONNECT event", async () => {
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(false)

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          playerId: 100,
          steamId: "STEAM_0:1:123456",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.1:27005",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockSessionService.createSession).toHaveBeenCalledWith({
        serverId: 1,
        gameUserId: 10,
        databasePlayerId: 100,
        steamId: "STEAM_0:1:123456",
        playerName: "TestPlayer",
        isBot: false,
      })
    })

    it("should return error for invalid event type", async () => {
      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 100,
          victimId: 200,
          weapon: "ak47",
          headshot: false,
          killerTeam: "CT",
          victimTeam: "TERRORIST",
        },
      }

      const result = await handler.handle(event as unknown as PlayerConnectEvent)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid event type")
    })

    it("should return error when playerId is missing", async () => {
      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          steamId: "STEAM_0:1:123456",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.1:27005",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain("playerId not resolved")
    })

    it("should skip session creation for bots when IgnoreBots is true", async () => {
      vi.mocked(mockServerService.getServerConfigBoolean).mockResolvedValue(true)

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          playerId: 100,
          steamId: "BOT",
          playerName: "Bot Expert",
          ipAddress: "",
        },
        meta: {
          playerName: "Bot Expert",
          steamId: "BOT",
          isBot: true,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockSessionService.createSession).not.toHaveBeenCalled()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Not creating session for bot"),
      )
    })

    it("should accept gameUserId of 0 as valid", async () => {
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(true)

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 0, // 0 is a valid gameUserId
          playerId: 100,
          steamId: "STEAM_0:1:123456",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.1:27005",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockSessionService.createSession).toHaveBeenCalledWith({
        serverId: 1,
        gameUserId: 0,
        databasePlayerId: 100,
        steamId: "STEAM_0:1:123456",
        playerName: "TestPlayer",
        isBot: false,
      })
    })

    it("should enrich player with GeoIP data", async () => {
      vi.mocked(mockGeoipService.lookup).mockResolvedValue({
        city: "New York",
        country: "US",
        latitude: 40.7128,
        longitude: -74.006,
        flag: "🇺🇸",
      })
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(false)

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          playerId: 100,
          steamId: "STEAM_0:1:123456",
          playerName: "TestPlayer",
          ipAddress: "8.8.8.8:27015",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      expect(mockGeoipService.lookup).toHaveBeenCalledWith("8.8.8.8:27015")
      expect(mockRepository.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          city: "New York",
          country: "US",
        }),
      )
    })

    it("should handle GeoIP lookup errors gracefully", async () => {
      vi.mocked(mockGeoipService.lookup).mockRejectedValue(new Error("GeoIP database error"))
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(true)

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          playerId: 100,
          steamId: "STEAM_0:1:123456",
          playerName: "TestPlayer",
          ipAddress: "8.8.8.8:27015",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("GeoIP lookup failed"))
    })

    it("should send connect notification", async () => {
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(false)
      vi.mocked(mockRepository.findById).mockResolvedValue({
        playerId: 100,
        country: "US",
        uniqueId: "STEAM_0:1:123456",
        game: "cstrike",
        lastName: "TestPlayer",
      } as unknown as Awaited<ReturnType<typeof mockRepository.findById>>)

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          playerId: 100,
          steamId: "STEAM_0:1:123456",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.1:27005",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      expect(mockNotificationService.notifyConnectEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 1,
          playerId: 100,
          playerName: "TestPlayer",
          playerCountry: "US",
        }),
      )
    })

    it("should not create duplicate connect events", async () => {
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(true)

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          playerId: 100,
          steamId: "STEAM_0:1:123456",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.1:27005",
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      expect(mockRepository.createConnectEvent).not.toHaveBeenCalled()
    })

    it("should update player name usage", async () => {
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(true)

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          gameUserId: 10,
          playerId: 100,
          steamId: "STEAM_0:1:123456",
          playerName: "NewName",
          ipAddress: "192.168.1.1:27005",
        },
        meta: {
          playerName: "NewName",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      expect(mockRepository.upsertPlayerName).toHaveBeenCalledWith(
        100,
        "NewName",
        expect.any(Object),
      )
    })
  })
})
