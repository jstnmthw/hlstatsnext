/**
 * RoundHandler Unit Tests
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from "vitest"
import { RoundHandler } from "./round.handler"
import { createMockLogger } from "../../../tests/mocks/logger"
import type {
  RoundStartEvent,
  RoundEndEvent,
  TeamWinEvent,
  MapChangeEvent,
  IMatchService,
} from "../match.types"
import { EventType } from "@/shared/types/events"

// Helper types for testing
type TestResult = {
  success: boolean
  error?: string
}

type RoundHandlerWithMethods = {
  [method: string]: (event: unknown) => Promise<TestResult>
}

describe("RoundHandler", () => {
  let roundHandler: RoundHandler
  let mockMatchService: IMatchService
  let mockLogger: ReturnType<typeof createMockLogger>

  // Store specific mock functions for easy access
  let mockHandleMatchEvent: MockedFunction<IMatchService["handleMatchEvent"]>

  beforeEach(() => {
    mockLogger = createMockLogger()

    // Create properly typed mock functions
    mockHandleMatchEvent = vi.fn()

    mockMatchService = {
      handleMatchEvent: mockHandleMatchEvent,
      handleObjectiveEvent: vi.fn(),
      handleKillInMatch: vi.fn(),
      getMatchStats: vi.fn(),
      resetMatchStats: vi.fn(),
      updatePlayerWeaponStats: vi.fn(),
      calculateMatchMVP: vi.fn(),
      calculatePlayerScore: vi.fn(),
    } as unknown as IMatchService

    roundHandler = new RoundHandler(mockMatchService, mockLogger)
  })

  describe("Handler instantiation", () => {
    it("should create handler instance", () => {
      expect(roundHandler).toBeDefined()
      expect(roundHandler).toBeInstanceOf(RoundHandler)
    })

    it("should have required methods", () => {
      expect(roundHandler.handleRoundStart).toBeDefined()
      expect(roundHandler.handleRoundEnd).toBeDefined()
      expect(roundHandler.handleTeamWin).toBeDefined()
      expect(roundHandler.handleMapChange).toBeDefined()
      expect(typeof roundHandler.handleRoundStart).toBe("function")
      expect(typeof roundHandler.handleRoundEnd).toBe("function")
      expect(typeof roundHandler.handleTeamWin).toBe("function")
      expect(typeof roundHandler.handleMapChange).toBe("function")
    })
  })

  describe("handleRoundStart", () => {
    it("should handle round start events successfully", async () => {
      const roundStartEvent: RoundStartEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ROUND_START,
        data: {
          map: "de_dust2",
          roundNumber: 1,
          maxPlayers: 10,
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockHandleMatchEvent.mockResolvedValue(expectedResult)

      const result = await roundHandler.handleRoundStart(roundStartEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(roundStartEvent)
    })

    it("should handle pistol round events", async () => {
      const pistolRoundEvent: RoundStartEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ROUND_START,
        data: {
          map: "de_dust2",
          roundNumber: 1,
          maxPlayers: 10,
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockHandleMatchEvent.mockResolvedValue(expectedResult)

      const result = await roundHandler.handleRoundStart(pistolRoundEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(pistolRoundEvent)
    })

    it("should handle service errors in round start", async () => {
      const roundStartEvent: RoundStartEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ROUND_START,
        data: {
          map: "de_dust2",
          roundNumber: 1,
          maxPlayers: 10,
        },
      }

      const serviceError = new Error("Round start processing failed")
      mockHandleMatchEvent.mockRejectedValue(serviceError)

      const result = await roundHandler.handleRoundStart(roundStartEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Round start processing failed")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Round start handler failed: Error: Round start processing failed",
      )
    })
  })

  describe("handleRoundEnd", () => {
    it("should handle round end events successfully", async () => {
      const roundEndEvent: RoundEndEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ROUND_END,
        data: {
          winningTeam: "ct",
          duration: 89.5,
          score: {
            team1: 1,
            team2: 0,
          },
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockHandleMatchEvent.mockResolvedValue(expectedResult)

      const result = await roundHandler.handleRoundEnd(roundEndEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(roundEndEvent)
    })

    it("should handle bomb defuse round end", async () => {
      const bombDefuseEndEvent: RoundEndEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ROUND_END,
        data: {
          winningTeam: "ct",
          duration: 75.2,
          score: {
            team1: 2,
            team2: 0,
          },
        },
      }

      const expectedResult = { success: true, affected: 2 }
      mockHandleMatchEvent.mockResolvedValue(expectedResult)

      const result = await roundHandler.handleRoundEnd(bombDefuseEndEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(bombDefuseEndEvent)
    })

    it("should handle service errors in round end", async () => {
      const roundEndEvent: RoundEndEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ROUND_END,
        data: {
          winningTeam: "ct",
          duration: 60,
          score: {
            team1: 1,
            team2: 0,
          },
        },
      }

      const serviceError = new Error("Round end processing failed")
      mockHandleMatchEvent.mockRejectedValue(serviceError)

      const result = await roundHandler.handleRoundEnd(roundEndEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Round end processing failed")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Round end handler failed: Error: Round end processing failed",
      )
    })
  })

  describe("handleTeamWin", () => {
    it("should handle team win events successfully", async () => {
      const teamWinEvent: TeamWinEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.TEAM_WIN,
        data: {
          winningTeam: "ct",
          triggerName: "round_end",
          score: {
            ct: 16,
            t: 14,
          },
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockHandleMatchEvent.mockResolvedValue(expectedResult)

      const result = await roundHandler.handleTeamWin(teamWinEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(teamWinEvent)
    })

    it("should handle overtime team win", async () => {
      const overtimeWinEvent: TeamWinEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.TEAM_WIN,
        data: {
          winningTeam: "terrorist",
          triggerName: "round_end",
          score: {
            ct: 18,
            t: 19,
          },
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockHandleMatchEvent.mockResolvedValue(expectedResult)

      const result = await roundHandler.handleTeamWin(overtimeWinEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(overtimeWinEvent)
    })

    it("should handle service errors in team win", async () => {
      const teamWinEvent: TeamWinEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.TEAM_WIN,
        data: {
          winningTeam: "ct",
          triggerName: "round_end",
          score: {
            ct: 16,
            t: 10,
          },
        },
      }

      const serviceError = new Error("Team win processing failed")
      mockHandleMatchEvent.mockRejectedValue(serviceError)

      const result = await roundHandler.handleTeamWin(teamWinEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Team win processing failed")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Team win handler failed: Error: Team win processing failed",
      )
    })
  })

  describe("handleMapChange", () => {
    it("should handle map change events successfully", async () => {
      const mapChangeEvent: MapChangeEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.MAP_CHANGE,
        data: {
          previousMap: "de_dust2",
          newMap: "de_inferno",
          playerCount: 10,
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockHandleMatchEvent.mockResolvedValue(expectedResult)

      const result = await roundHandler.handleMapChange(mapChangeEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(mapChangeEvent)
    })

    it("should handle initial map load", async () => {
      const initialMapEvent: MapChangeEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.MAP_CHANGE,
        data: {
          previousMap: undefined,
          newMap: "de_mirage",
          playerCount: 0,
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockHandleMatchEvent.mockResolvedValue(expectedResult)

      const result = await roundHandler.handleMapChange(initialMapEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(initialMapEvent)
    })

    it("should handle service errors in map change", async () => {
      const mapChangeEvent: MapChangeEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.MAP_CHANGE,
        data: {
          previousMap: "de_cache",
          newMap: "de_nuke",
          playerCount: 10,
        },
      }

      const serviceError = new Error("Map change processing failed")
      mockHandleMatchEvent.mockRejectedValue(serviceError)

      const result = await roundHandler.handleMapChange(mapChangeEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Map change processing failed")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Map change handler failed: Error: Map change processing failed",
      )
    })
  })

  describe("Error handling", () => {
    it("should handle non-Error exceptions across all methods", async () => {
      const events = [
        {
          method: "handleRoundStart",
          event: {
            timestamp: new Date(),
            serverId: 1,
            eventType: EventType.ROUND_START,
            data: { map: "de_dust2", roundNumber: 1, maxPlayers: 10 },
          },
        },
        {
          method: "handleRoundEnd",
          event: {
            timestamp: new Date(),
            serverId: 1,
            eventType: EventType.ROUND_END,
            data: { winningTeam: "ct" },
          },
        },
        {
          method: "handleTeamWin",
          event: {
            timestamp: new Date(),
            serverId: 1,
            eventType: EventType.TEAM_WIN,
            data: { winningTeam: "ct", triggerName: "round_end", score: { ct: 16, t: 14 } },
          },
        },
        {
          method: "handleMapChange",
          event: {
            timestamp: new Date(),
            serverId: 1,
            eventType: EventType.MAP_CHANGE,
            data: { newMap: "de_test", playerCount: 10 },
          },
        },
      ]

      for (const { method, event } of events) {
        mockHandleMatchEvent.mockRejectedValue("String error")

        const result = await (roundHandler as unknown as RoundHandlerWithMethods)[method]?.(event)

        expect(result?.success).toBe(false)
        expect(result?.error).toBe("String error")
      }
    })

    it("should handle timeout errors", async () => {
      const roundStartEvent: RoundStartEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ROUND_START,
        data: {
          map: "de_dust2",
          roundNumber: 1,
          maxPlayers: 10,
        },
      }

      const timeoutError = new Error("Request timeout")
      timeoutError.name = "TimeoutError"
      mockHandleMatchEvent.mockRejectedValue(timeoutError)

      const result = await roundHandler.handleRoundStart(roundStartEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Request timeout")
    })
  })

  describe("Edge cases", () => {
    it("should handle events with minimal data", async () => {
      const minimalRoundEnd: RoundEndEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.ROUND_END,
        data: {
          winningTeam: "ct",
        },
      }

      const expectedResult = { success: true }
      mockHandleMatchEvent.mockResolvedValue(expectedResult)

      const result = await roundHandler.handleRoundEnd(minimalRoundEnd)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleMatchEvent).toHaveBeenCalledWith(minimalRoundEnd)
    })

    it("should preserve service result structure", async () => {
      const teamWinEvent: TeamWinEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.TEAM_WIN,
        data: {
          winningTeam: "terrorist",
          triggerName: "round_end",
          score: {
            ct: 14,
            t: 16,
          },
        },
      }

      const serviceResult = {
        success: true,
        affected: 2,
        metadata: {
          matchType: "competitive",
          duration: 2400,
          mvp: { playerId: 5, rating: 1.45 },
        },
      }
      mockHandleMatchEvent.mockResolvedValue(serviceResult)

      const result = await roundHandler.handleTeamWin(teamWinEvent)

      expect(result).toEqual(serviceResult)
      expect(result.affected).toBe(2)
    })

    it("should handle service returning failure result", async () => {
      const mapChangeEvent: MapChangeEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.MAP_CHANGE,
        data: {
          previousMap: "de_ancient",
          newMap: "invalid_map",
          playerCount: 0,
        },
      }

      const serviceResult = {
        success: false,
        error: "Invalid map name",
      }
      mockHandleMatchEvent.mockResolvedValue(serviceResult)

      const result = await roundHandler.handleMapChange(mapChangeEvent)

      expect(result).toEqual(serviceResult)
      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid map name")
    })
  })
})
