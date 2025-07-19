/**
 * Objective Events Handler Tests
 *
 * Tests for new objective-based events (bomb plant/defuse, hostage rescue, flag capture, etc.)
 * integrated into the MatchHandler.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { MatchHandler } from "../../../src/services/processor/handlers/match.handler"
import { createMockLogger, createMockDatabaseClient } from "../../types/test-mocks"
import type {
  BombPlantEvent,
  BombDefuseEvent,
  BombExplodeEvent,
  HostageRescueEvent,
  HostageTouchEvent,
  FlagCaptureEvent,
  ControlPointCaptureEvent,
} from "../../../src/types/common/events"
import { EventType } from "../../../src/types/common/events"
import type { IPlayerService } from "src/services/player/player.types"
import type { DatabaseClient } from "src/database/client"

describe("MatchHandler - Objective Events", () => {
  let handler: MatchHandler
  let mockPlayerService: IPlayerService
  let mockDatabase: DatabaseClient
  const loggerMock = createMockLogger()

  beforeEach(() => {
    vi.clearAllMocks()

    mockPlayerService = {
      getRoundParticipants: vi.fn().mockResolvedValue([]),
    } as unknown as IPlayerService

    // Create extended mock database client with additional methods needed for MatchHandler
    mockDatabase = createMockDatabaseClient({
      prisma: {
        server: {
          findFirst: vi.fn(),
          create: vi.fn(),
          update: vi.fn().mockResolvedValue({}), // Add the missing update method
          findUnique: vi.fn(),
        },
        eventPlayerAction: {
          create: vi.fn().mockResolvedValue({}),
        },
        eventWorldAction: {
          create: vi.fn().mockResolvedValue({}),
        },
        playerHistory: {
          create: vi.fn().mockResolvedValue({}),
        },
        mapCount: {
          upsert: vi.fn().mockResolvedValue({}),
        },
      },
    }) as unknown as DatabaseClient

    // Add spies property for test compatibility
    ;(mockDatabase as unknown as { spies: Record<string, unknown> }).spies = {
      serverUpdate: mockDatabase.prisma.server.update,
      eventPlayerActionCreate: mockDatabase.prisma.eventPlayerAction.create,
      eventWorldActionCreate: mockDatabase.prisma.eventWorldAction.create,
    }

    handler = new MatchHandler(mockPlayerService, mockDatabase, loggerMock)
  })

  describe("Bomb Events", () => {
    it("should handle BOMB_PLANT event and update stats", async () => {
      const bombPlantEvent: BombPlantEvent = {
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          bombsite: "A",
          position: { x: 100, y: 200, z: 50 },
          team: "TERRORIST",
        },
        meta: {
          steamId: "STEAM_1:0:123456",
          playerName: "TestPlayer",
          isBot: false,
        },
      }

      // Initialize match stats by triggering a round start
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 10 },
      })

      const result = await handler.handleEvent(bombPlantEvent)

      expect(result.success).toBe(true)
      expect(result.roundsAffected).toBe(0)

      // Verify database update for bomb planted
      expect(mockDatabase.spies.serverUpdate).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: { bombs_planted: { increment: 1 } },
      })

      // Verify player objective score was updated
      const matchStats = handler.getMatchStats(1)
      expect(matchStats).toBeDefined()
      expect(matchStats?.playerStats.get(123)?.objectiveScore).toBe(3)
    })

    it("should handle BOMB_DEFUSE event and update stats", async () => {
      const bombDefuseEvent: BombDefuseEvent = {
        eventType: EventType.BOMB_DEFUSE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 456,
          bombsite: "A",
          position: { x: 100, y: 200, z: 50 },
          team: "CT",
          timeRemaining: 15,
        },
        meta: {
          steamId: "STEAM_1:0:654321",
          playerName: "DefusePlayer",
          isBot: false,
        },
      }

      // Initialize match stats
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 10 },
      })

      const result = await handler.handleEvent(bombDefuseEvent)

      expect(result.success).toBe(true)

      // Verify database update for bomb defused
      expect(mockDatabase.spies.serverUpdate).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: { bombs_defused: { increment: 1 } },
      })

      // Verify player objective score was updated
      const matchStats = handler.getMatchStats(1)
      expect(matchStats?.playerStats.get(456)?.objectiveScore).toBe(3)
    })

    it("should handle BOMB_EXPLODE event without player ID", async () => {
      const bombExplodeEvent: BombExplodeEvent = {
        eventType: EventType.BOMB_EXPLODE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          bombsite: "A",
          position: { x: 100, y: 200, z: 50 },
          planterPlayerId: 123,
        },
      }

      // Initialize match stats
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 10 },
      })

      const result = await handler.handleEvent(bombExplodeEvent)

      expect(result.success).toBe(true)

      // No database updates expected for bomb explode
      expect(mockDatabase.spies.serverUpdate).not.toHaveBeenCalled()

      // No player score updates expected (no playerId)
      const matchStats = handler.getMatchStats(1)
      expect(matchStats?.playerStats.size).toBe(0)
    })
  })

  describe("Hostage Events", () => {
    it("should handle HOSTAGE_RESCUE event", async () => {
      const hostageRescueEvent: HostageRescueEvent = {
        eventType: EventType.HOSTAGE_RESCUE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 789,
          hostageId: 1,
          position: { x: 300, y: 400, z: 100 },
          team: "CT",
        },
        meta: {
          steamId: "STEAM_1:0:987654",
          playerName: "RescuePlayer",
          isBot: false,
        },
      }

      // Initialize match stats
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "cs_office", roundNumber: 1, maxPlayers: 10 },
      })

      const result = await handler.handleEvent(hostageRescueEvent)

      expect(result.success).toBe(true)

      // Verify player objective score was updated with correct points
      const matchStats = handler.getMatchStats(1)
      expect(matchStats?.playerStats.get(789)?.objectiveScore).toBe(2)
    })

    it("should handle HOSTAGE_TOUCH event", async () => {
      const hostageEvent: HostageTouchEvent = {
        eventType: EventType.HOSTAGE_TOUCH,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 789,
          hostageId: 1,
          position: { x: 300, y: 400, z: 100 },
          team: "CT",
        },
        meta: {
          steamId: "STEAM_1:0:987654",
          playerName: "TouchPlayer",
          isBot: false,
        },
      }

      // Initialize match stats
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "cs_office", roundNumber: 1, maxPlayers: 10 },
      })

      const result = await handler.handleEvent(hostageEvent)

      expect(result.success).toBe(true)

      // Verify player objective score was updated with correct points
      const matchStats = handler.getMatchStats(1)
      expect(matchStats?.playerStats.get(789)?.objectiveScore).toBe(1)
    })
  })

  describe("Flag Events", () => {
    it("should handle FLAG_CAPTURE event", async () => {
      const flagCaptureEvent: FlagCaptureEvent = {
        eventType: EventType.FLAG_CAPTURE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 111,
          flagTeam: "BLUE",
          captureTeam: "RED",
          position: { x: 500, y: 600, z: 200 },
        },
        meta: {
          steamId: "STEAM_1:0:111111",
          playerName: "FlagCapture",
          isBot: false,
        },
      }

      // Initialize match stats
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "ctf_2fort", roundNumber: 1, maxPlayers: 24 },
      })

      const result = await handler.handleEvent(flagCaptureEvent)

      expect(result.success).toBe(true)

      // Verify player objective score was updated with highest points
      const matchStats = handler.getMatchStats(1)
      expect(matchStats?.playerStats.get(111)?.objectiveScore).toBe(5)
    })

    it("should handle FLAG_DEFEND event", async () => {
      const flagDefendEvent = {
        eventType: EventType.FLAG_DEFEND,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 222,
          flagTeam: "RED",
          position: { x: 100, y: 100, z: 50 },
          team: "RED",
        },
        meta: {
          steamId: "STEAM_1:0:222222",
          playerName: "FlagDefender",
          isBot: false,
        },
      }

      // Initialize match stats
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "ctf_2fort", roundNumber: 1, maxPlayers: 24 },
      })

      const result = await handler.handleEvent(flagDefendEvent)

      expect(result.success).toBe(true)

      // Verify player objective score
      const matchStats = handler.getMatchStats(1)
      expect(matchStats?.playerStats.get(222)?.objectiveScore).toBe(3)
    })
  })

  describe("Control Point Events", () => {
    it("should handle CONTROL_POINT_CAPTURE event", async () => {
      const cpCaptureEvent: ControlPointCaptureEvent = {
        eventType: EventType.CONTROL_POINT_CAPTURE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 333,
          pointName: "Point A",
          pointId: 1,
          capturingTeam: "BLUE",
          previousOwner: "RED",
          position: { x: 800, y: 900, z: 300 },
          captureTime: 45,
        },
        meta: {
          steamId: "STEAM_1:0:333333",
          playerName: "PointCapturer",
          isBot: false,
        },
      }

      // Initialize match stats
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "cp_dustbowl", roundNumber: 1, maxPlayers: 24 },
      })

      const result = await handler.handleEvent(cpCaptureEvent)

      expect(result.success).toBe(true)

      // Verify player objective score
      const matchStats = handler.getMatchStats(1)
      expect(matchStats?.playerStats.get(333)?.objectiveScore).toBe(4)
    })
  })

  describe("Error Handling", () => {
    it("should handle objective events when no match stats exist", async () => {
      const bombPlantEvent: BombPlantEvent = {
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date(),
        serverId: 999, // Non-existent server
        data: {
          playerId: 123,
          bombsite: "A",
          team: "TERRORIST",
        },
      }

      const result = await handler.handleEvent(bombPlantEvent)

      expect(result.success).toBe(true)
      expect(loggerMock.warn).toHaveBeenCalledWith(
        "No match stats found for server 999 during objective event",
      )
    })

    it("should handle database errors gracefully", async () => {
      const bombPlantEvent: BombPlantEvent = {
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          bombsite: "A",
          team: "TERRORIST",
        },
      }

      // Initialize match stats
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 10 },
      })

      // Mock database error
      mockDatabase.spies.serverUpdate.mockRejectedValueOnce(new Error("Database error"))

      const result = await handler.handleEvent(bombPlantEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Database error")
    })
  })

  describe("Objective Points Calculation", () => {
    it("should award correct points for different objective types", async () => {
      // Initialize match stats
      await handler.handleEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 10 },
      })

      const baseEvent = {
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 123, team: "TEST" },
        meta: { steamId: "STEAM_1:0:123456", playerName: "TestPlayer", isBot: false },
      }

      // Test different event types and their point values
      const testCases = [
        { eventType: EventType.BOMB_PLANT, expectedPoints: 3 },
        { eventType: EventType.BOMB_DEFUSE, expectedPoints: 3 },
        { eventType: EventType.HOSTAGE_RESCUE, expectedPoints: 2 },
        { eventType: EventType.HOSTAGE_TOUCH, expectedPoints: 1 },
        { eventType: EventType.FLAG_CAPTURE, expectedPoints: 5 },
        { eventType: EventType.FLAG_DEFEND, expectedPoints: 3 },
        { eventType: EventType.FLAG_PICKUP, expectedPoints: 1 },
        { eventType: EventType.CONTROL_POINT_CAPTURE, expectedPoints: 4 },
        { eventType: EventType.CONTROL_POINT_DEFEND, expectedPoints: 2 },
      ]

      let totalExpectedPoints = 0
      for (const testCase of testCases) {
        await handler.handleEvent({ ...baseEvent, eventType: testCase.eventType })
        totalExpectedPoints += testCase.expectedPoints
      }

      const matchStats = handler.getMatchStats(1)
      expect(matchStats?.playerStats.get(123)?.objectiveScore).toBe(totalExpectedPoints)
    })
  })
})
