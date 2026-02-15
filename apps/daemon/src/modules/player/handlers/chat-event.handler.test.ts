/**
 * Chat Event Handler Tests
 *
 * Tests for player chat event handling.
 */

import type { IMapService } from "@/modules/map/map.service"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerRepository, PlayerChatEvent } from "@/modules/player/types/player.types"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { createMockPlayerRepository } from "@/tests/mocks/player.repository.mock"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ChatEventHandler } from "./chat-event.handler"

function createMockMatchService(): IMatchService {
  return {
    handleMatchEvent: vi.fn(),
    getMatchStats: vi.fn(),
    resetMatchStats: vi.fn(),
    setPlayerTeam: vi.fn(),
    getPlayersByTeam: vi.fn().mockReturnValue([]),
    getServerGame: vi.fn().mockResolvedValue("cstrike"),
  }
}

function createMockMapService(): IMapService {
  return {
    getCurrentMap: vi.fn().mockResolvedValue("de_dust2"),
    getLastKnownMap: vi.fn(),
    handleMapChange: vi.fn(),
  }
}

describe("ChatEventHandler", () => {
  let handler: ChatEventHandler
  let mockRepository: IPlayerRepository
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockMatchService: IMatchService
  let mockMapService: IMapService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockRepository = createMockPlayerRepository()
    mockMatchService = createMockMatchService()
    mockMapService = createMockMapService()

    handler = new ChatEventHandler(mockRepository, mockLogger, mockMatchService, mockMapService)
  })

  describe("handle", () => {
    it("should process valid CHAT_MESSAGE event", async () => {
      const event: PlayerChatEvent = {
        eventType: EventType.CHAT_MESSAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          message: "Hello world!",
          team: "CT",
          isDead: false,
          messageMode: 0,
        },
      }

      const result = await handler.handle(event)

      expect(result.success).toBe(true)
      expect(mockRepository.createChatEvent).toHaveBeenCalledWith(
        100,
        1,
        "de_dust2",
        "Hello world!",
        0,
      )
    })

    it("should return error for invalid event type", async () => {
      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 100 },
      } as any

      const result = await handler.handle(event)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Invalid event type")
    })

    it("should use current map from map service", async () => {
      vi.mocked(mockMapService.getCurrentMap).mockResolvedValue("de_inferno")

      const event: PlayerChatEvent = {
        eventType: EventType.CHAT_MESSAGE,
        timestamp: new Date(),
        serverId: 2,
        data: {
          playerId: 200,
          message: "GG",
          team: "TERRORIST",
          isDead: false,
          messageMode: 1,
        },
      }

      await handler.handle(event)

      expect(mockRepository.createChatEvent).toHaveBeenCalledWith(200, 2, "de_inferno", "GG", 1)
    })

    it("should handle team chat (messageMode 1)", async () => {
      const event: PlayerChatEvent = {
        eventType: EventType.CHAT_MESSAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          message: "Rush B!",
          team: "CT",
          isDead: false,
          messageMode: 1,
        },
      }

      await handler.handle(event)

      expect(mockRepository.createChatEvent).toHaveBeenCalledWith(100, 1, "de_dust2", "Rush B!", 1)
    })

    it("should default messageMode to 0 if not provided", async () => {
      const event: PlayerChatEvent = {
        eventType: EventType.CHAT_MESSAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          message: "No mode specified",
          team: "CT",
          isDead: false,
        },
      }

      await handler.handle(event)

      expect(mockRepository.createChatEvent).toHaveBeenCalledWith(
        100,
        1,
        "de_dust2",
        "No mode specified",
        0,
      )
    })

    it("should log chat message", async () => {
      const event: PlayerChatEvent = {
        eventType: EventType.CHAT_MESSAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 100,
          message: "Test message",
          team: "CT",
          isDead: false,
          messageMode: 0,
        },
      }

      await handler.handle(event)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Player 100 says: "Test message"'),
      )
    })
  })
})
