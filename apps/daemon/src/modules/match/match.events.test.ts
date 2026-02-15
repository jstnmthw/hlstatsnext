/**
 * Match Event Handler Tests
 *
 * Tests for match-specific event handling.
 */

import type { IActionService } from "@/modules/action/action.types"
import type { IMatchService } from "@/modules/match/match.types"
import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MatchEventHandler } from "./match.events"

function createMockMatchService(): IMatchService {
  return {
    handleMatchEvent: vi.fn().mockResolvedValue(undefined),
    getMatchStats: vi.fn(),
    resetMatchStats: vi.fn(),
    setPlayerTeam: vi.fn(),
    getPlayersByTeam: vi.fn().mockReturnValue([]),
    getServerGame: vi.fn().mockResolvedValue("cstrike"),
  }
}

function createMockActionService(): IActionService {
  return {
    handleActionEvent: vi.fn().mockResolvedValue(undefined),
  }
}

describe("MatchEventHandler", () => {
  let handler: MatchEventHandler
  let mockLogger: ILogger
  let mockMatchService: IMatchService
  let mockActionService: IActionService

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockMatchService = createMockMatchService()
    mockActionService = createMockActionService()
    handler = new MatchEventHandler(mockLogger, mockMatchService, mockActionService)
  })

  describe("handleRoundStart", () => {
    it("should handle ROUND_START event", async () => {
      const event = {
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-1",
        data: {},
      }

      await handler.handleRoundStart(event)

      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(event)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Match module handling ROUND_START"),
      )
    })
  })

  describe("handleRoundEnd", () => {
    it("should handle ROUND_END event", async () => {
      const event = {
        eventType: EventType.ROUND_END,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-2",
        data: {},
      }

      await handler.handleRoundEnd(event)

      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(event)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Match module handling ROUND_END"),
      )
    })
  })

  describe("handleTeamWin", () => {
    it("should handle TEAM_WIN event and synthesize ACTION_TEAM", async () => {
      const event = {
        eventType: EventType.TEAM_WIN,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-3",
        data: {
          winningTeam: "CT",
          triggerName: "CTs_Win",
        },
      }

      await handler.handleTeamWin(event)

      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(event)
      expect(mockMatchService.getServerGame).toHaveBeenCalledWith(1)
      expect(mockActionService.handleActionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.ACTION_TEAM,
          serverId: 1,
          data: expect.objectContaining({
            team: "CT",
            actionCode: "CTs_Win",
            game: "cstrike",
            bonus: 0,
          }),
        }),
      )
    })

    it("should not call action service when not provided", async () => {
      const handlerWithoutAction = new MatchEventHandler(mockLogger, mockMatchService)

      const event = {
        eventType: EventType.TEAM_WIN,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-4",
        data: {
          winningTeam: "TERRORIST",
          triggerName: "Terrorists_Win",
        },
      }

      await handlerWithoutAction.handleTeamWin(event)

      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(event)
      expect(mockActionService.handleActionEvent).not.toHaveBeenCalled()
    })

    it("should use 'valve' as default game when getServerGame returns null", async () => {
      vi.mocked(mockMatchService.getServerGame).mockResolvedValue(null as any)

      const event = {
        eventType: EventType.TEAM_WIN,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-5",
        data: {
          winningTeam: "CT",
          triggerName: "CTs_Win",
        },
      }

      await handler.handleTeamWin(event)

      expect(mockActionService.handleActionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            game: "valve",
          }),
        }),
      )
    })

    it("should log warning when ACTION_TEAM synthesis fails", async () => {
      vi.mocked(mockActionService.handleActionEvent).mockRejectedValue(new Error("Action error"))

      const event = {
        eventType: EventType.TEAM_WIN,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-6",
        data: {
          winningTeam: "CT",
          triggerName: "CTs_Win",
        },
      }

      await handler.handleTeamWin(event)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to synthesize ACTION_TEAM"),
      )
    })
  })

  describe("handleMapChange", () => {
    it("should handle MAP_CHANGE event", async () => {
      const event = {
        eventType: EventType.MAP_CHANGE,
        timestamp: new Date(),
        serverId: 1,
        eventId: "test-7",
        data: {
          previousMap: "de_dust2",
          newMap: "de_inferno",
        },
      }

      await handler.handleMapChange(event)

      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(event)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Match module handling MAP_CHANGE"),
      )
    })
  })

  describe("with metrics", () => {
    it("should create handler with metrics", () => {
      const mockMetrics = {
        recordEvent: vi.fn(),
        recordEventDuration: vi.fn(),
        getMetrics: vi.fn(),
      }

      const handlerWithMetrics = new MatchEventHandler(
        mockLogger,
        mockMatchService,
        mockActionService,
        mockMetrics as any,
      )

      expect(handlerWithMetrics).toBeDefined()
    })
  })
})
