import { describe, it, expect, vi, beforeEach } from "vitest"
import { MatchHandler } from "../../src/services/processor/handlers/match.handler"
import { createMockLogger } from "../types/test-mocks"
import {
  EventType,
  type RoundEndEvent,
  type MapChangeEvent,
  RoundStartEvent,
  PlayerKillEvent,
} from "../../src/types/common/events"
import type { IPlayerService } from "../../src/services/player/player.types"
import type { DatabaseClient } from "../../src/database/client"

describe("MatchHandler", () => {
  let handler: MatchHandler
  let mockPlayerService: IPlayerService
  let mockDatabase: DatabaseClient
  const loggerMock = createMockLogger()

  beforeEach(() => {
    mockPlayerService = {
      getOrCreatePlayer: vi.fn(),
      getPlayerStats: vi.fn(),
      updatePlayerStats: vi.fn(),
      getPlayerRating: vi.fn(),
      updatePlayerRatings: vi.fn(),
      getRoundParticipants: vi.fn(),
      getTopPlayers: vi.fn(),
    }

    mockDatabase = {
      transaction: vi.fn(),
      testConnection: vi.fn(),
      disconnect: vi.fn(),
      prisma: {
        server: {
          update: vi.fn(),
        },
        playerHistory: {
          create: vi.fn(),
        },
      },
    } as unknown as DatabaseClient

    handler = new MatchHandler(mockPlayerService, mockDatabase, loggerMock)
  })

  describe("handleEvent", () => {
    it("should handle ROUND_START and initialize stats", async () => {
      const event: RoundStartEvent = {
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: {
          map: "de_dust2",
          roundNumber: 1,
          maxPlayers: 10,
        },
      }
      const result = await handler.handleEvent(event)

      expect(result.success).toBe(true)
      const stats = handler.getMatchStats(1)
      expect(stats).toBeDefined()
      expect(stats?.totalRounds).toBe(0)
    })

    it("should handle ROUND_END and update stats", async () => {
      // First, start a round to initialize
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: {
          map: "de_dust2",
          roundNumber: 1,
          maxPlayers: 10,
        },
      } as RoundStartEvent)

      const roundEndEvent: RoundEndEvent = {
        eventType: EventType.ROUND_END,
        serverId: 1,
        timestamp: new Date(),
        data: {
          winningTeam: "TERRORIST",
          duration: 120,
          score: { team1: 1, team2: 0 },
        },
      }

      const result = await handler.handleEvent(roundEndEvent)
      expect(result.success).toBe(true)

      const stats = handler.getMatchStats(1)
      expect(stats?.totalRounds).toBe(1)
      expect(stats?.duration).toBe(120)
      expect(stats?.teamScores["TERRORIST"]).toBe(1)
    })

    it("should handle MAP_CHANGE and finalize/reset stats", async () => {
      // Start a round and end it to create stats
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        serverId: 1,
        timestamp: new Date(),
        data: {
          map: "de_dust2",
          roundNumber: 1,
          maxPlayers: 10,
        },
      } as RoundStartEvent)
      await handler.handleEvent({
        eventType: EventType.ROUND_END,
        serverId: 1,
        timestamp: new Date(),
        data: {
          winningTeam: "CT",
          duration: 100,
          score: { team1: 0, team2: 1 },
        },
      } as RoundEndEvent)

      const mapChangeEvent: MapChangeEvent = {
        eventType: EventType.MAP_CHANGE,
        serverId: 1,
        timestamp: new Date(),
        data: {
          previousMap: "de_dust2",
          newMap: "de_inferno",
          playerCount: 10,
        },
      }

      // @ts-expect-error - Testing private method
      const finalizeSpy = vi.spyOn(handler, "finalizeMatch")
      await handler.handleEvent(mapChangeEvent)

      expect(finalizeSpy).toHaveBeenCalledWith(1, "de_dust2", expect.any(Object))

      const stats = handler.getMatchStats(1)
      expect(stats).toBeUndefined()
    })

    it("should ignore unhandled events", async () => {
      // Create a PLAYER_KILL event which MatchHandler does **not** process
      const unhandledEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      const result = await handler.handleEvent(unhandledEvent)

      // Should report success but **not** mutate internal match state
      expect(result.success).toBe(true)
      expect(handler.getMatchStats(1)).toBeUndefined()
    })

    it("should not throw on ROUND_END if no match stats exist", async () => {
      const roundEndEvent: RoundEndEvent = {
        eventType: EventType.ROUND_END,
        serverId: 99, // A server with no stats
        timestamp: new Date(),
        data: {
          winningTeam: "TERRORIST",
          duration: 120,
          score: { team1: 1, team2: 0 },
        },
      } as RoundEndEvent
      const result = await handler.handleEvent(roundEndEvent)
      expect(result.success).toBe(true)
      expect(loggerMock.warn).toHaveBeenCalledWith("No match stats found for server 99")
    })
  })
})
