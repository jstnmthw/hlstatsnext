/**
 * Action Event Handler Tests
 *
 * Tests for action-specific event handling.
 */

import type { IActionService } from "@/modules/action/action.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ActionEventHandler } from "./action.events"

function createMockActionService(): IActionService {
  return {
    handleActionEvent: vi.fn().mockResolvedValue(undefined),
  }
}

function createMockSessionService(): IPlayerSessionService {
  return {
    createSession: vi.fn(),
    updateSession: vi.fn(),
    removeSession: vi.fn(),
    clearServerSessions: vi.fn(),
    getSessionByGameUserId: vi.fn(),
    getSessionByPlayerId: vi.fn(),
    getSessionBySteamId: vi.fn(),
    getServerSessions: vi.fn(),
    synchronizeServerSessions: vi.fn(),
    convertToGameUserIds: vi.fn(),
    canSendPrivateMessage: vi.fn(),
    getSessionStats: vi.fn(),
  }
}

describe("ActionEventHandler", () => {
  let handler: ActionEventHandler
  let mockLogger: ILogger
  let mockActionService: IActionService
  let mockSessionService: IPlayerSessionService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockActionService = createMockActionService()
    mockSessionService = createMockSessionService()
    handler = new ActionEventHandler(mockLogger, mockActionService, mockSessionService)
  })

  describe("handleActionPlayer", () => {
    it("should handle valid ACTION_PLAYER event", async () => {
      const event = {
        eventType: EventType.ACTION_PLAYER,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-1",
        data: {
          gameUserId: 100,
          actionCode: "defused_the_bomb",
          game: "cstrike",
          team: "CT",
          bonus: 10,
        },
      }

      vi.mocked(mockSessionService.getSessionByGameUserId).mockResolvedValue({
        serverId: 1,
        gameUserId: 100,
        databasePlayerId: 500,
        playerName: "TestPlayer",
        steamId: "STEAM_0:1:123456",
        isBot: false,
        connectedAt: new Date(),
        lastSeen: new Date(),
      })

      await handler.handleActionPlayer(event)

      expect(mockSessionService.getSessionByGameUserId).toHaveBeenCalledWith(1, 100)
      expect(mockActionService.handleActionEvent).toHaveBeenCalled()
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Action module handling ACTION_PLAYER"),
      )
    })

    it("should warn on invalid ACTION_PLAYER event structure", async () => {
      const event = {
        eventType: EventType.ACTION_PLAYER,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-1",
        data: {}, // Missing required fields
      }

      await handler.handleActionPlayer(event)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid ACTION_PLAYER event structure"),
      )
      expect(mockActionService.handleActionEvent).not.toHaveBeenCalled()
    })

    it("should use gameUserId as fallback when no session found", async () => {
      const event = {
        eventType: EventType.ACTION_PLAYER,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-1",
        data: {
          gameUserId: 100,
          actionCode: "planted_the_bomb",
          game: "cstrike",
          team: "TERRORIST",
          bonus: 5,
        },
      }

      vi.mocked(mockSessionService.getSessionByGameUserId).mockResolvedValue(null)
      vi.mocked(mockSessionService.synchronizeServerSessions).mockResolvedValue(0)

      await handler.handleActionPlayer(event)

      expect(mockActionService.handleActionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            playerId: 100, // Fallback to gameUserId
          }),
        }),
      )
    })

    it("should attempt to synchronize sessions when no session found", async () => {
      const event = {
        eventType: EventType.ACTION_PLAYER,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-1",
        data: {
          gameUserId: 100,
          actionCode: "hostage_rescued",
          game: "cstrike",
          team: "CT",
          bonus: 5,
        },
      }

      vi.mocked(mockSessionService.getSessionByGameUserId)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          serverId: 1,
          gameUserId: 100,
          databasePlayerId: 600,
          playerName: "RescuedPlayer",
          steamId: "STEAM_0:1:654321",
          isBot: false,
          connectedAt: new Date(),
          lastSeen: new Date(),
        })

      await handler.handleActionPlayer(event)

      expect(mockSessionService.synchronizeServerSessions).toHaveBeenCalledWith(1, {
        clearExisting: false,
      })
    })
  })

  describe("handleActionPlayerPlayer", () => {
    it("should handle valid ACTION_PLAYER_PLAYER event", async () => {
      const event = {
        eventType: EventType.ACTION_PLAYER_PLAYER,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-2",
        data: {
          gameUserId: 100,
          victimGameUserId: 200,
          actionCode: "revenge",
          game: "cstrike",
          bonus: 3,
        },
      }

      vi.mocked(mockSessionService.getSessionByGameUserId)
        .mockResolvedValueOnce({
          serverId: 1,
          gameUserId: 100,
          databasePlayerId: 500,
          playerName: "Player1",
          steamId: "STEAM_0:1:111",
          isBot: false,
          connectedAt: new Date(),
          lastSeen: new Date(),
        })
        .mockResolvedValueOnce({
          serverId: 1,
          gameUserId: 200,
          databasePlayerId: 600,
          playerName: "Player2",
          steamId: "STEAM_0:1:222",
          isBot: false,
          connectedAt: new Date(),
          lastSeen: new Date(),
        })

      await handler.handleActionPlayerPlayer(event)

      expect(mockActionService.handleActionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            playerId: 500,
            victimId: 600,
          }),
        }),
      )
    })

    it("should warn on invalid ACTION_PLAYER_PLAYER event structure", async () => {
      const event = {
        eventType: EventType.ACTION_PLAYER_PLAYER,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-2",
        data: {
          gameUserId: 100,
          // Missing victimGameUserId
        },
      }

      await handler.handleActionPlayerPlayer(event)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid ACTION_PLAYER_PLAYER event structure"),
      )
    })

    it("should use fallback IDs when sessions not found", async () => {
      const event = {
        eventType: EventType.ACTION_PLAYER_PLAYER,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-2",
        data: {
          gameUserId: 100,
          victimGameUserId: 200,
          actionCode: "domination",
          game: "tf",
          bonus: 5,
        },
      }

      vi.mocked(mockSessionService.getSessionByGameUserId).mockResolvedValue(null)

      await handler.handleActionPlayerPlayer(event)

      expect(mockActionService.handleActionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            playerId: 100,
            victimId: 200,
          }),
        }),
      )
    })
  })

  describe("handleActionTeam", () => {
    it("should handle valid ACTION_TEAM event", async () => {
      const event = {
        eventType: EventType.ACTION_TEAM,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-3",
        data: {
          team: "CT",
          actionCode: "CTs_Win",
          game: "cstrike",
          bonus: 2,
        },
      }

      await handler.handleActionTeam(event)

      expect(mockActionService.handleActionEvent).toHaveBeenCalledWith(event)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Action module handling ACTION_TEAM"),
      )
    })

    it("should warn on invalid ACTION_TEAM event structure", async () => {
      // Pass a different event type to fail the isActionTeamEvent type guard
      const event = {
        eventType: EventType.ACTION_PLAYER, // Wrong type
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-3",
        data: {
          team: "CT",
          actionCode: "CTs_Win",
          game: "cstrike",
        },
      }

      await handler.handleActionTeam(event)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid ACTION_TEAM event structure"),
      )
      expect(mockActionService.handleActionEvent).not.toHaveBeenCalled()
    })
  })

  describe("handleActionWorld", () => {
    it("should handle valid ACTION_WORLD event", async () => {
      const event = {
        eventType: EventType.ACTION_WORLD,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-4",
        data: {
          actionCode: "Round_Start",
          game: "cstrike",
        },
      }

      await handler.handleActionWorld(event)

      expect(mockActionService.handleActionEvent).toHaveBeenCalledWith(event)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Action module handling ACTION_WORLD"),
      )
    })

    it("should warn on invalid ACTION_WORLD event structure", async () => {
      // Pass a different event type to fail the isWorldActionEvent type guard
      const event = {
        eventType: EventType.ACTION_PLAYER, // Wrong type
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-4",
        data: {
          actionCode: "Round_Start",
          game: "cstrike",
        },
      }

      await handler.handleActionWorld(event)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid ACTION_WORLD event structure"),
      )
      expect(mockActionService.handleActionEvent).not.toHaveBeenCalled()
    })
  })

  describe("error handling", () => {
    it("should handle session service errors gracefully in ACTION_PLAYER", async () => {
      const event = {
        eventType: EventType.ACTION_PLAYER,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-err",
        data: {
          gameUserId: 100,
          actionCode: "test_action",
          game: "cstrike",
          team: "CT",
          bonus: 0,
        },
      }

      vi.mocked(mockSessionService.getSessionByGameUserId).mockRejectedValue(
        new Error("Session error"),
      )

      await handler.handleActionPlayer(event)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resolve player ids"),
      )
      // Should still call the action service with fallback ID
      expect(mockActionService.handleActionEvent).toHaveBeenCalled()
    })

    it("should handle session service errors gracefully in ACTION_PLAYER_PLAYER", async () => {
      const event = {
        eventType: EventType.ACTION_PLAYER_PLAYER,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-err",
        data: {
          gameUserId: 100,
          victimGameUserId: 200,
          actionCode: "test_action",
          game: "cstrike",
          bonus: 0,
        },
      }

      vi.mocked(mockSessionService.getSessionByGameUserId).mockRejectedValue(
        new Error("Session error"),
      )

      await handler.handleActionPlayerPlayer(event)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to resolve player ids"),
      )
      expect(mockActionService.handleActionEvent).toHaveBeenCalled()
    })
  })
})
