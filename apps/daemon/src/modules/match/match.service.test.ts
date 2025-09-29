/**
 * MatchService Unit Tests
 */
import type {
  IMatchRepository,
  RoundStartEvent,
  RoundEndEvent,
  TeamWinEvent,
  MapChangeEvent,
} from "./match.types"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { MatchService } from "./match.service"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"

const mockRepository: IMatchRepository = {
  updateBombStats: vi.fn(),
  incrementServerRounds: vi.fn(),
  updateTeamWins: vi.fn(),
  resetMapStats: vi.fn(),
  getLastKnownMap: vi.fn(),
  findServerById: vi.fn(),
  createPlayerHistory: vi.fn(),
  updateMapCount: vi.fn(),
  updateServerStats: vi.fn(),
  getPlayerSkill: vi.fn(),
}

const mockLogger = createMockLogger()

vi.mock("@/config/game.config", () => ({
  GameConfig: {
    getUnknownMap: vi.fn().mockReturnValue("unknown"),
    getDefaultGame: vi.fn().mockReturnValue("cstrike"),
  },
}))

describe("MatchService", () => {
  let matchService: MatchService

  beforeEach(() => {
    vi.clearAllMocks()
    matchService = new MatchService(mockRepository, mockLogger)
  })

  describe("Service instantiation", () => {
    it("should create service instance", () => {
      expect(matchService).toBeDefined()
      expect(matchService).toBeInstanceOf(MatchService)
    })
  })

  describe("handleMatchEvent", () => {
    it("should handle ROUND_START events", async () => {
      const event: RoundStartEvent = {
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: {
          map: "de_dust2",
          roundNumber: 1,
          maxPlayers: 20,
        },
      }

      const result = await matchService.handleMatchEvent(event)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(1)
      expect(mockLogger.debug).toHaveBeenCalledWith("Round started on server 1, map: de_dust2")
    })

    it("should handle ROUND_END events", async () => {
      const event: RoundEndEvent = {
        eventType: EventType.ROUND_END,
        serverId: 1,
        timestamp: new Date(),
        data: {
          winningTeam: "CT",
          duration: 120,
          score: { team1: 12, team2: 8 },
        },
      }

      const result = await matchService.handleMatchEvent(event)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(1)
      expect(mockRepository.incrementServerRounds).not.toHaveBeenCalled()
    })

    it("should handle TEAM_WIN events", async () => {
      const event: TeamWinEvent = {
        eventType: EventType.TEAM_WIN,
        serverId: 1,
        timestamp: new Date(),
        data: {
          winningTeam: "CT",
          triggerName: "CTs_Win",
          score: { ct: 16, t: 10 },
        },
      }

      const result = await matchService.handleMatchEvent(event)

      expect(result.success).toBe(true)
      expect(result.affected).toBe(1)
      expect(mockRepository.incrementServerRounds).toHaveBeenCalledWith(1)
      expect(mockRepository.updateTeamWins).toHaveBeenCalledWith(1, "CT")
    })

    it("should handle MAP_CHANGE events", async () => {
      vi.mocked(mockRepository.findServerById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
      })

      const event: MapChangeEvent = {
        eventType: EventType.MAP_CHANGE,
        serverId: 1,
        timestamp: new Date(),
        data: {
          previousMap: "de_dust2",
          newMap: "de_mirage",
          playerCount: 16,
        },
      }

      const result = await matchService.handleMatchEvent(event)

      expect(result.success).toBe(true)
      expect(mockRepository.resetMapStats).toHaveBeenCalledWith(1, "de_mirage", 16)
    })

    it("should handle unknown event types", async () => {
      const event: MapChangeEvent = {
        eventType: EventType.MAP_CHANGE,
        serverId: 1,
        timestamp: new Date(),
        data: {
          previousMap: "de_dust2",
          newMap: "de_inferno",
          playerCount: 10,
        },
      }

      const result = await matchService.handleMatchEvent(event)

      expect(result.success).toBe(true)
    })

    it("should handle errors in match event processing", async () => {
      vi.mocked(mockRepository.incrementServerRounds).mockRejectedValue(new Error("Database error"))

      const event: TeamWinEvent = {
        eventType: EventType.TEAM_WIN,
        serverId: 1,
        timestamp: new Date(),
        data: {
          winningTeam: "CT",
          triggerName: "CTs_Win",
          score: { ct: 16, t: 14 },
        },
      }

      const result = await matchService.handleMatchEvent(event)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Database error")
    })
  })

  // Objective events are now handled via ACTION_* flows; legacy tests removed
  // Kill events are now handled by PlayerService; legacy tests removed

  // Map initialization is now handled by MapService; legacy tests removed

  // MVP calculation was removed as it's not used in production

  describe("getMatchStats", () => {
    it("should return undefined for non-existent server", () => {
      const stats = matchService.getMatchStats(999)
      expect(stats).toBeUndefined()
    })

    it("should return match stats for existing server", async () => {
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 20 },
      })

      const stats = matchService.getMatchStats(1)
      expect(stats).toBeDefined()
      expect(stats!.totalRounds).toBe(0)
      expect(stats!.teamScores).toEqual({})
    })
  })

  describe("resetMatchStats", () => {
    it("should reset match statistics for server", async () => {
      // First create some match stats
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 20 },
      })

      expect(matchService.getMatchStats(1)).toBeDefined()

      matchService.resetMatchStats(1)

      expect(matchService.getMatchStats(1)).toBeUndefined()
      expect(mockLogger.info).toHaveBeenCalledWith("Reset match statistics for server 1")
    })
  })

  // Weapon stats, player scoring, and objective actions are now handled by other services
})
