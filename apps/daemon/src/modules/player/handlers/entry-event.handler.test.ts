/**
 * Entry Event Handler Tests
 *
 * Tests for player entry event handling.
 */

import type { IMapService } from "@/modules/map/map.service"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IPlayerRepository, PlayerEvent } from "@/modules/player/types/player.types"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockMatchService } from "@/tests/mocks/match.service.mock"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import { createMockSessionService } from "@/tests/mocks/session.service.mock"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EntryEventHandler } from "./entry-event.handler"

function createMockMapService(): IMapService {
  return {
    getCurrentMap: vi.fn().mockResolvedValue("de_dust2"),
    getLastKnownMap: vi.fn(),
    handleMapChange: vi.fn(),
  }
}

describe("EntryEventHandler", () => {
  let handler: EntryEventHandler
  let mockRepository: IPlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockSessionService: IPlayerSessionService
  let mockMatchService: IMatchService
  let mockMapService: IMapService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockPlayerRepository()
    mockSessionService = createMockSessionService()
    mockMatchService = createMockMatchService()
    mockMapService = createMockMapService()

    handler = new EntryEventHandler(
      mockRepository,
      mockLogger,
      mockSessionService,
      mockMatchService,
      mockMapService,
    )
  })

  describe("handle", () => {
    it("should process valid PLAYER_ENTRY event", async () => {
      vi.mocked(mockSessionService.getSessionByPlayerId).mockResolvedValue(null)
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(false)

      const event: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 1,
        data: {
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
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Processing PLAYER_ENTRY"),
        expect.any(Object),
      )
    })

    it("should return error for invalid event type", async () => {
      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 100 },
      } as unknown as PlayerEvent

      const result = await handler.handle(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid event type")
    })

    it("should return error when playerId is missing", async () => {
      const event: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 1,
        data: {} as { playerId: number },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain("No playerId")
    })

    it("should not create session if one already exists", async () => {
      vi.mocked(mockSessionService.getSessionByPlayerId).mockResolvedValue({
        serverId: 1,
        gameUserId: 10,
        databasePlayerId: 100,
        playerName: "TestPlayer",
        steamId: "STEAM_0:1:123456",
        isBot: false,
        connectedAt: new Date(),
        lastSeen: new Date(),
      })

      const event: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
        },
        meta: {
          playerName: "TestPlayer",
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      expect(mockSessionService.createSession).not.toHaveBeenCalled()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Session already exists"),
        expect.any(Object),
      )
    })

    it("should not create session without gameUserId in event data", async () => {
      vi.mocked(mockSessionService.getSessionByPlayerId).mockResolvedValue(null)
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(true)

      // PlayerEntryEvent only has playerId, not gameUserId, so session cannot be created
      const event: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
        },
        meta: {
          playerName: "NewPlayer",
          steamId: "STEAM_0:0:654321",
          isBot: false,
        },
      }

      await handler.handle(event)

      // Without gameUserId, the handler attempts RCON status lookup fallback
      // and session is not created directly
      expect(mockSessionService.createSession).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("No gameUserId provided"),
      )
    })

    it("should synthesize connect event if no recent connect exists", async () => {
      vi.mocked(mockSessionService.getSessionByPlayerId).mockResolvedValue(null)
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(false)
      vi.mocked(mockMapService.getCurrentMap).mockResolvedValue("de_inferno")

      const event: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 200,
        },
        meta: {
          playerName: "BotPlayer",
          steamId: "BOT",
          isBot: true,
        },
      }

      await handler.handle(event)

      expect(mockRepository.createConnectEvent).toHaveBeenCalledWith(200, 1, "de_inferno", "")
      expect(mockRepository.updateServerForPlayerEvent).toHaveBeenCalledWith(1, {
        activePlayers: { increment: 1 },
        lastEvent: expect.any(Date),
      })
    })

    it("should not synthesize connect if recent connect exists", async () => {
      vi.mocked(mockSessionService.getSessionByPlayerId).mockResolvedValue(null)
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(true)

      const event: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
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

    it("should not create session when playerName is missing in meta", async () => {
      vi.mocked(mockSessionService.getSessionByPlayerId).mockResolvedValue(null)
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(true)

      // When meta is missing playerName, the handler cannot attempt RCON lookup
      // and since there's no gameUserId either, it should complete without session creation
      const event: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
        },
        meta: {
          playerName: "", // Empty playerName
          steamId: "STEAM_0:1:123456",
          isBot: false,
        },
      }

      await handler.handle(event)

      // Without playerName and gameUserId, the session creation logic is skipped
      expect(mockSessionService.createSession).not.toHaveBeenCalled()
    })

    it("should handle session creation errors gracefully", async () => {
      vi.mocked(mockSessionService.getSessionByPlayerId).mockRejectedValue(
        new Error("Database error"),
      )
      vi.mocked(mockRepository.hasRecentConnect).mockResolvedValue(true)

      const event: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 1,
        data: {
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
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to ensure session exists"),
        expect.any(Object),
      )
    })

    it("should handle synthesize connect errors gracefully", async () => {
      vi.mocked(mockSessionService.getSessionByPlayerId).mockResolvedValue(null)
      vi.mocked(mockRepository.hasRecentConnect).mockRejectedValue(new Error("DB error"))

      const event: PlayerEvent = {
        eventType: EventType.PLAYER_ENTRY,
        timestamp: new Date(),
        serverId: 1,
        data: {
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
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Failed to synthesize connect"),
      )
    })
  })
})
