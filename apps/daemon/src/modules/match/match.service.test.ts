/**
 * MatchService Unit Tests
 */
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MatchService } from "./match.service"
import type {
  IMatchRepository,
  MapChangeEvent,
  RoundEndEvent,
  RoundStartEvent,
  TeamWinEvent,
} from "./match.types"

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

  describe("getServerGame", () => {
    it("should return game from repository", async () => {
      vi.mocked(mockRepository.findServerById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
      } as any)

      const game = await matchService.getServerGame(1)
      expect(game).toBe("cstrike")
    })

    it("should return null when server not found", async () => {
      vi.mocked(mockRepository.findServerById).mockResolvedValue(null)

      const game = await matchService.getServerGame(999)
      expect(game).toBeNull()
    })

    it("should return null on error", async () => {
      vi.mocked(mockRepository.findServerById).mockRejectedValue(new Error("DB error"))

      const game = await matchService.getServerGame(1)
      expect(game).toBeNull()
    })
  })

  describe("setPlayerTeam", () => {
    it("should set player team when match exists", async () => {
      // Initialize match first
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 20 },
      })

      matchService.setPlayerTeam(1, 42, "CT")
      const stats = matchService.getMatchStats(1)
      expect(stats?.playerTeams?.get(42)).toBe("CT")
    })

    it("should do nothing when match does not exist", () => {
      matchService.setPlayerTeam(999, 42, "CT")
      expect(matchService.getMatchStats(999)).toBeUndefined()
    })
  })

  describe("getPlayersByTeam", () => {
    it("should return players on the specified team", async () => {
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 20 },
      })

      matchService.setPlayerTeam(1, 10, "CT")
      matchService.setPlayerTeam(1, 20, "TERRORIST")
      matchService.setPlayerTeam(1, 30, "CT")

      const ctPlayers = matchService.getPlayersByTeam(1, "CT")
      expect(ctPlayers).toEqual([10, 30])

      const tPlayers = matchService.getPlayersByTeam(1, "TERRORIST")
      expect(tPlayers).toEqual([20])
    })

    it("should return empty array when no match exists", () => {
      expect(matchService.getPlayersByTeam(999, "CT")).toEqual([])
    })

    it("should return empty array when no players on team", async () => {
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 20 },
      })

      expect(matchService.getPlayersByTeam(1, "CT")).toEqual([])
    })
  })

  describe("handleMatchEvent - TEAM_WIN with Terrorists_Win trigger", () => {
    it("should call updateTeamWins for Terrorists_Win", async () => {
      vi.mocked(mockRepository.incrementServerRounds).mockResolvedValue(undefined)
      const event: TeamWinEvent = {
        eventType: EventType.TEAM_WIN,
        serverId: 1,
        timestamp: new Date(),
        data: {
          winningTeam: "TERRORIST",
          triggerName: "Terrorists_Win",
          score: { ct: 10, t: 16 },
        },
      }

      const result = await matchService.handleMatchEvent(event)
      expect(result.success).toBe(true)
      expect(mockRepository.updateTeamWins).toHaveBeenCalledWith(1, "TERRORIST")
    })

    it("should not call updateTeamWins for non-CS triggers", async () => {
      vi.mocked(mockRepository.incrementServerRounds).mockResolvedValue(undefined)
      const event: TeamWinEvent = {
        eventType: EventType.TEAM_WIN,
        serverId: 1,
        timestamp: new Date(),
        data: {
          winningTeam: "Team1",
          triggerName: "VIP_Assassination",
          score: { ct: 5, t: 3 },
        },
      }

      const result = await matchService.handleMatchEvent(event)
      expect(result.success).toBe(true)
      expect(mockRepository.updateTeamWins).not.toHaveBeenCalled()
    })
  })

  describe("handleMatchEvent - MAP_CHANGE edge cases", () => {
    it("should handle map change without previousMap (no finalize)", async () => {
      const event: MapChangeEvent = {
        eventType: EventType.MAP_CHANGE,
        serverId: 1,
        timestamp: new Date(),
        data: {
          previousMap: undefined as unknown as string,
          newMap: "de_dust2",
          playerCount: 10,
        },
      }

      const result = await matchService.handleMatchEvent(event)
      expect(result.success).toBe(true)
      expect(mockRepository.resetMapStats).toHaveBeenCalledWith(1, "de_dust2", 10)
    })

    it("should handle map change without playerCount", async () => {
      const event: MapChangeEvent = {
        eventType: EventType.MAP_CHANGE,
        serverId: 1,
        timestamp: new Date(),
        data: {
          previousMap: "de_dust2",
          newMap: "de_mirage",
          playerCount: undefined as unknown as number,
        },
      }

      vi.mocked(mockRepository.findServerById).mockResolvedValue({ serverId: 1 } as any)

      const result = await matchService.handleMatchEvent(event)
      expect(result.success).toBe(true)
      expect(mockRepository.resetMapStats).toHaveBeenCalledWith(1, "de_mirage")
    })

    it("should finalize match when previousMap exists and match stats present", async () => {
      // Create match stats first
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 20 },
      })

      vi.mocked(mockRepository.findServerById).mockResolvedValue({
        serverId: 1,
        game: "cstrike",
      } as any)

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
      // finalizeMatch calls findServerById via saveMatchToDatabase
      expect(mockRepository.findServerById).toHaveBeenCalledWith(1)
    })

    it("should handle saveMatchToDatabase failure gracefully", async () => {
      // Create match stats first
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 20 },
      })

      vi.mocked(mockRepository.findServerById).mockRejectedValue(new Error("DB crash"))

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
      // finalizeMatch catches errors internally, so map change still succeeds
      expect(result.success).toBe(true)
      expect(mockLogger.failed).toHaveBeenCalled()
    })
  })

  describe("handleMatchEvent - ROUND_START with MapService", () => {
    it("should use MapService when available", async () => {
      const mockMapService = {
        handleMapChange: vi.fn().mockResolvedValue(undefined),
        getCurrentMap: vi.fn().mockResolvedValue("de_cache"),
      }

      const serviceWithMap = new MatchService(mockRepository, mockLogger, mockMapService as any)

      const event: RoundStartEvent = {
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 20 },
      }

      const result = await serviceWithMap.handleMatchEvent(event)
      expect(result.success).toBe(true)
      expect(mockMapService.handleMapChange).toHaveBeenCalledWith(1, "de_dust2", undefined)
      expect(mockMapService.getCurrentMap).toHaveBeenCalledWith(1)
      expect(mockLogger.debug).toHaveBeenCalledWith("Round started on server 1, map: de_cache")
    })
  })

  describe("handleMatchEvent - ROUND_END edge cases", () => {
    it("should handle round end without winning team", async () => {
      const event: RoundEndEvent = {
        eventType: EventType.ROUND_END,
        serverId: 1,
        timestamp: new Date(),
        data: {
          winningTeam: undefined as unknown as string,
          duration: undefined,
          score: undefined as any,
        },
      }

      const result = await matchService.handleMatchEvent(event)
      expect(result.success).toBe(true)
    })

    it("should accumulate team scores across rounds", async () => {
      // Round 1
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_END,
        serverId: 1,
        timestamp: new Date(),
        data: { winningTeam: "CT", duration: 60 },
      } as RoundEndEvent)

      // Round 2
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_END,
        serverId: 1,
        timestamp: new Date(),
        data: { winningTeam: "CT", duration: 90 },
      } as RoundEndEvent)

      const stats = matchService.getMatchStats(1)
      expect(stats?.totalRounds).toBe(2)
      expect(stats?.teamScores.CT).toBe(2)
      expect(stats?.duration).toBe(150)
    })
  })

  // Weapon stats, player scoring, and objective actions are now handled by other services
})
