/**
 * MatchService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { MatchService } from "./match.service"
import { EventType } from "@/shared/types/events"
import type {
  IMatchRepository,
  RoundStartEvent,
  RoundEndEvent,
  TeamWinEvent,
  MapChangeEvent,
  ObjectiveEvent,
} from "./match.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { BaseEvent } from "@/shared/types/events"

const mockRepository: IMatchRepository = {
  updateBombStats: vi.fn(),
  incrementServerRounds: vi.fn(),
  updateTeamWins: vi.fn(),
  resetMapStats: vi.fn(),
  getLastKnownMap: vi.fn(),
  findServerById: vi.fn(),
  createPlayerHistory: vi.fn(),
  updateMapCount: vi.fn(),
} as unknown as IMatchRepository

const mockLogger: ILogger = {
  info: vi.fn(),
  debug: vi.fn(),
  event: vi.fn(),
  queue: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  failed: vi.fn(),
} as unknown as ILogger

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
      expect(mockLogger.debug).toHaveBeenCalledWith("Round started on server 1")
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
      expect(mockRepository.incrementServerRounds).toHaveBeenCalledWith(1)
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
      expect(mockRepository.resetMapStats).toHaveBeenCalledWith(1, "de_mirage")
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

      const event: RoundEndEvent = {
        eventType: EventType.ROUND_END,
        serverId: 1,
        timestamp: new Date(),
        data: {},
      }

      const result = await matchService.handleMatchEvent(event)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Database error")
    })
  })

  describe("handleObjectiveEvent", () => {
    it("should handle BOMB_PLANT events", async () => {
      const event: ObjectiveEvent = {
        eventType: EventType.BOMB_PLANT,
        serverId: 1,
        timestamp: new Date(),
        data: {
          playerId: 123,
          bombsite: "A",
          team: "terrorist",
        },
      }

      const result = await matchService.handleObjectiveEvent(event)

      expect(result.success).toBe(true)
      expect(mockRepository.updateBombStats).toHaveBeenCalledWith(1, "plant")
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Objective event processed: BOMB_PLANT by player 123 (+3 points)",
        ),
      )
    })

    it("should handle BOMB_DEFUSE events", async () => {
      const event: ObjectiveEvent = {
        eventType: EventType.BOMB_DEFUSE,
        serverId: 1,
        timestamp: new Date(),
        data: {
          playerId: 456,
          team: "ct",
        },
      }

      const result = await matchService.handleObjectiveEvent(event)

      expect(result.success).toBe(true)
      expect(mockRepository.updateBombStats).toHaveBeenCalledWith(1, "defuse")
    })

    it("should handle events without player ID", async () => {
      const event: ObjectiveEvent = {
        eventType: EventType.BOMB_EXPLODE,
        serverId: 1,
        timestamp: new Date(),
        data: {
          bombsite: "B",
        },
      }

      const result = await matchService.handleObjectiveEvent(event)

      expect(result.success).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Objective event processed: BOMB_EXPLODE"),
      )
    })

    it("should auto-initialize match context", async () => {
      const event: ObjectiveEvent = {
        eventType: EventType.FLAG_CAPTURE,
        serverId: 2,
        timestamp: new Date(),
        data: {
          playerId: 789,
          flagTeam: "blue",
          captureTeam: "red",
        },
      }

      const result = await matchService.handleObjectiveEvent(event)

      expect(result.success).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith("Auto-initializing match context for server 2")
    })

    it("should handle errors in objective event processing", async () => {
      vi.mocked(mockRepository.updateBombStats).mockRejectedValue(new Error("Database error"))

      const event: ObjectiveEvent = {
        eventType: EventType.BOMB_PLANT,
        serverId: 1,
        timestamp: new Date(),
        data: {
          playerId: 123,
          team: "terrorist",
        },
      }

      const result = await matchService.handleObjectiveEvent(event)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Database error")
    })
  })

  describe("handleKillInMatch", () => {
    it("should handle kill events and update player stats", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 123,
          victimId: 456,
          headshot: true,
        },
      }

      const result = await matchService.handleKillInMatch(event)

      expect(result.success).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Kill event processed in match: player 123 killed player 456 (headshot)",
      )
    })

    it("should handle kill events without headshot", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 123,
          victimId: 456,
          headshot: false,
        },
      }

      const result = await matchService.handleKillInMatch(event)

      expect(result.success).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Kill event processed in match: player 123 killed player 456",
      )
    })

    it("should auto-initialize match context for kills", async () => {
      const event: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 3,
        timestamp: new Date(),
        data: {
          killerId: 111,
          victimId: 222,
          headshot: false,
        },
      }

      const result = await matchService.handleKillInMatch(event)

      expect(result.success).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith("Auto-initializing match context for server 3")
    })
  })

  describe("initializeMapForServer", () => {
    it("should return existing map if available", async () => {
      // First set up a match with an existing map
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 20 },
      })

      const map = await matchService.initializeMapForServer(1)

      expect(map).toBe("de_dust2")
    })

    it("should get map from database if no current match", async () => {
      vi.mocked(mockRepository.getLastKnownMap).mockResolvedValue("de_mirage")

      const map = await matchService.initializeMapForServer(2)

      expect(map).toBe("de_mirage")
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Detected map from database for server 2: de_mirage",
      )
    })

    it("should use fallback when no map found", async () => {
      vi.mocked(mockRepository.getLastKnownMap).mockResolvedValue(null)

      const map = await matchService.initializeMapForServer(3)

      expect(map).toBe("unknown")
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "No map found for server 3 - using fallback: unknown",
      )
    })

    it("should handle errors gracefully", async () => {
      vi.mocked(mockRepository.getLastKnownMap).mockRejectedValue(new Error("Database error"))

      const map = await matchService.initializeMapForServer(4)

      expect(map).toBe("unknown")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to initialize map for server 4: Error: Database error",
      )
    })
  })

  describe("calculateMatchMVP", () => {
    it("should return undefined for servers with no match stats", async () => {
      const mvp = await matchService.calculateMatchMVP(999)
      expect(mvp).toBeUndefined()
    })

    it("should return undefined for matches with no players", async () => {
      // Initialize empty match
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 20 },
      })

      const mvp = await matchService.calculateMatchMVP(1)
      expect(mvp).toBeUndefined()
    })

    it("should calculate MVP based on player scores", async () => {
      // Initialize match and add player stats
      await matchService.handleKillInMatch({
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: { killerId: 123, victimId: 456, headshot: true },
      })

      await matchService.handleKillInMatch({
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: { killerId: 789, victimId: 456, headshot: false },
      })

      const mvp = await matchService.calculateMatchMVP(1)
      expect(mvp).toBeDefined()
      expect([123, 789]).toContain(mvp)
    })
  })

  describe("getMatchStats and getCurrentMap", () => {
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
      expect(stats?.currentMap).toBe("de_dust2")
    })

    it("should return current map for server", async () => {
      await matchService.handleMatchEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: { map: "de_mirage", roundNumber: 1, maxPlayers: 20 },
      })

      const map = matchService.getCurrentMap(1)
      expect(map).toBe("de_mirage")
    })

    it("should return unknown map for server without match", () => {
      const map = matchService.getCurrentMap(999)
      expect(map).toBe("unknown")
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

  describe("updatePlayerWeaponStats", () => {
    it("should update player weapon statistics", () => {
      // First create a match with a player
      matchService.handleKillInMatch({
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: { killerId: 123, victimId: 456, headshot: false },
      })

      matchService.updatePlayerWeaponStats(1, 123, {
        shots: 10,
        hits: 3,
        damage: 75,
      })

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Updated weapon stats for player 123: +10 shots, +3 hits, +75 damage",
      )
    })

    it("should handle partial stats updates", () => {
      matchService.handleKillInMatch({
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: { killerId: 123, victimId: 456, headshot: false },
      })

      matchService.updatePlayerWeaponStats(1, 123, { hits: 2 })

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Updated weapon stats for player 123: +0 shots, +2 hits, +0 damage",
      )
    })

    it("should not update stats for non-existent match", () => {
      matchService.updatePlayerWeaponStats(999, 123, { shots: 10 })
      // Should not throw or log debug message
      expect(mockLogger.debug).not.toHaveBeenCalled()
    })
  })

  describe("calculatePlayerScore", () => {
    it("should calculate player score correctly", () => {
      const stats = {
        playerId: 123,
        kills: 10,
        deaths: 3,
        assists: 5,
        objectiveScore: 2,
        clutchWins: 1,
        damage: 0,
        headshots: 0,
        shots: 0,
        hits: 0,
        suicides: 0,
        teamkills: 0,
      }

      const score = matchService.calculatePlayerScore(stats)
      // (10 * 2) - (3 * 1) + (5 * 1) + (2 * 3) + (1 * 5) = 20 - 3 + 5 + 6 + 5 = 33
      expect(score).toBe(33)
    })

    it("should handle zero stats", () => {
      const stats = {
        playerId: 123,
        kills: 0,
        deaths: 0,
        assists: 0,
        objectiveScore: 0,
        clutchWins: 0,
        damage: 0,
        headshots: 0,
        shots: 0,
        hits: 0,
        suicides: 0,
        teamkills: 0,
      }

      const score = matchService.calculatePlayerScore(stats)
      expect(score).toBe(0)
    })
  })
})
