/**
 * PlayerEventHandler Unit Tests
 */

import type { PlayerEvent, IPlayerService } from "../player.types"
import { describe, it, expect, beforeEach, vi, Mocked } from "vitest"
import { PlayerEventHandler } from "./player-event.handler"
import { createMockLogger } from "../../../test-support/mocks/logger"
import { EventType } from "@/shared/types/events"

describe("PlayerEventHandler", () => {
  let playerEventHandler: PlayerEventHandler
  let mockPlayerService: Mocked<IPlayerService>
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockPlayerService = {
      handlePlayerEvent: vi.fn(),
      getOrCreatePlayer: vi.fn(),
      getPlayerStats: vi.fn(),
      updatePlayerStats: vi.fn(),
      getPlayerRating: vi.fn(),
      updatePlayerRatings: vi.fn(),
      getTopPlayers: vi.fn(),
      getRoundParticipants: vi.fn(),
      handleKillEvent: vi.fn(),
    }

    playerEventHandler = new PlayerEventHandler(mockPlayerService, mockLogger)
  })

  describe("Handler instantiation", () => {
    it("should create handler instance", () => {
      expect(playerEventHandler).toBeDefined()
      expect(playerEventHandler).toBeInstanceOf(PlayerEventHandler)
    })

    it("should have handleEvent method", () => {
      expect(playerEventHandler.handleEvent).toBeDefined()
      expect(typeof playerEventHandler.handleEvent).toBe("function")
    })
  })

  describe("handleEvent", () => {
    it("should delegate to player service successfully", async () => {
      const playerEvent: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_CONNECT,
        data: {
          playerId: 1,
          steamId: "76561198000000000",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.100",
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockPlayerService.handlePlayerEvent.mockResolvedValue(expectedResult)

      const result = await playerEventHandler.handleEvent(playerEvent)

      expect(result).toEqual(expectedResult)
      expect(mockPlayerService.handlePlayerEvent).toHaveBeenCalledWith(playerEvent)
    })

    it("should handle player disconnect events", async () => {
      const disconnectEvent: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_DISCONNECT,
        data: {
          playerId: 1,
          reason: "timeout",
          sessionDuration: 3600,
        },
      }

      const expectedResult = { success: true }
      mockPlayerService.handlePlayerEvent.mockResolvedValue(expectedResult)

      const result = await playerEventHandler.handleEvent(disconnectEvent)

      expect(result).toEqual(expectedResult)
      expect(mockPlayerService.handlePlayerEvent).toHaveBeenCalledWith(disconnectEvent)
    })

    it("should handle player suicide events", async () => {
      const suicideEvent: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_SUICIDE,
        data: {
          playerId: 1,
          weapon: "world",
          team: "ct",
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockPlayerService.handlePlayerEvent.mockResolvedValue(expectedResult)

      const result = await playerEventHandler.handleEvent(suicideEvent)

      expect(result).toEqual(expectedResult)
      expect(mockPlayerService.handlePlayerEvent).toHaveBeenCalledWith(suicideEvent)
    })

    it("should handle player team change events", async () => {
      const teamChangeEvent: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_CHANGE_TEAM,
        data: {
          playerId: 1,
          team: "ct",
        },
      }

      const expectedResult = { success: true }
      mockPlayerService.handlePlayerEvent.mockResolvedValue(expectedResult)

      const result = await playerEventHandler.handleEvent(teamChangeEvent)

      expect(result).toEqual(expectedResult)
      expect(mockPlayerService.handlePlayerEvent).toHaveBeenCalledWith(teamChangeEvent)
    })

    it("should handle service errors and return failure result", async () => {
      const playerEvent: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_CONNECT,
        data: {
          playerId: 1,
          steamId: "76561198000000000",
          playerName: "ErrorPlayer",
          ipAddress: "192.168.1.100",
        },
      }

      const serviceError = new Error("Service failure")
      mockPlayerService.handlePlayerEvent.mockRejectedValue(serviceError)

      const result = await playerEventHandler.handleEvent(playerEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Service failure")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Player event handler failed: Error: Service failure",
      )
    })

    it("should handle non-Error exceptions", async () => {
      const playerEvent: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_CONNECT,
        data: {
          playerId: 1,
          steamId: "76561198000000000",
          playerName: "StringErrorPlayer",
          ipAddress: "192.168.1.100",
        },
      }

      mockPlayerService.handlePlayerEvent.mockRejectedValue("String error")

      const result = await playerEventHandler.handleEvent(playerEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("String error")
      expect(mockLogger.error).toHaveBeenCalledWith("Player event handler failed: String error")
    })

    it("should preserve service result structure", async () => {
      const playerEvent: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_CONNECT,
        data: {
          playerId: 1,
          steamId: "76561198000000000",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.100",
        },
      }

      const serviceResult = {
        success: true,
        affected: 1,
        metadata: { created: true, updated: false },
      }
      mockPlayerService.handlePlayerEvent.mockResolvedValue(serviceResult)

      const result = await playerEventHandler.handleEvent(playerEvent)

      expect(result).toEqual(serviceResult)
      expect(result.affected).toBe(1)
    })

    it("should handle service returning failure result", async () => {
      const playerEvent: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_CONNECT,
        data: {
          playerId: 1,
          steamId: "invalid_steam_id",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.100",
        },
      }

      const serviceResult = {
        success: false,
        error: "Invalid Steam ID format",
      }
      mockPlayerService.handlePlayerEvent.mockResolvedValue(serviceResult)

      const result = await playerEventHandler.handleEvent(playerEvent)

      expect(result).toEqual(serviceResult)
      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid Steam ID format")
    })
  })

  describe("Error propagation", () => {
    it("should maintain error context from service", async () => {
      const playerEvent: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_DISCONNECT,
        data: {
          playerId: 999,
          reason: "kicked",
        },
      }

      const detailedError = new Error("Player not found in database")
      detailedError.stack =
        "Error: Player not found in database\n    at PlayerService.handlePlayerEvent"
      mockPlayerService.handlePlayerEvent.mockRejectedValue(detailedError)

      const result = await playerEventHandler.handleEvent(playerEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Player not found in database")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Player event handler failed: Error: Player not found in database",
      )
    })

    it("should handle timeout errors", async () => {
      const playerEvent: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_CONNECT,
        data: {
          playerId: 1,
          steamId: "76561198000000000",
          playerName: "TimeoutPlayer",
          ipAddress: "192.168.1.100",
        },
      }

      const timeoutError = new Error("Request timeout")
      timeoutError.name = "TimeoutError"
      mockPlayerService.handlePlayerEvent.mockRejectedValue(timeoutError)

      const result = await playerEventHandler.handleEvent(playerEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Request timeout")
    })
  })

  describe("Edge cases", () => {
    it("should handle events with minimal data", async () => {
      const minimalEvent: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_DISCONNECT,
        data: {
          playerId: 1,
        },
      }

      const expectedResult = { success: true }
      mockPlayerService.handlePlayerEvent.mockResolvedValue(expectedResult)

      const result = await playerEventHandler.handleEvent(minimalEvent)

      expect(result).toEqual(expectedResult)
      expect(mockPlayerService.handlePlayerEvent).toHaveBeenCalledWith(minimalEvent)
    })

    it("should handle events with additional metadata", async () => {
      const eventWithMeta: PlayerEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.PLAYER_CONNECT,
        data: {
          playerId: 1,
          steamId: "76561198000000000",
          playerName: "MetaPlayer",
          ipAddress: "192.168.1.100",
          country: "US",
          userAgent: "Game Client 1.0",
        },
        meta: {
          steamId: "76561198000000012",
          playerName: "MetaPlayer",
          isBot: false,
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockPlayerService.handlePlayerEvent.mockResolvedValue(expectedResult)

      const result = await playerEventHandler.handleEvent(eventWithMeta)

      expect(result).toEqual(expectedResult)
      expect(mockPlayerService.handlePlayerEvent).toHaveBeenCalledWith(eventWithMeta)
    })
  })
})
