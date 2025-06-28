import { describe, it, expect, beforeEach, vi } from "vitest"
import { PlayerHandler } from "../../src/services/processor/handlers/player.handler"
import {
  EventType,
  PlayerConnectEvent,
  PlayerDisconnectEvent,
  PlayerKillEvent,
  PlayerSuicideEvent,
  PlayerTeamkillEvent,
  MapChangeEvent,
} from "../../src/types/common/events"
import { DatabaseClient } from "../../src/database/client"

const mockGetOrCreatePlayer = vi.fn().mockResolvedValue(123)
const mockUpdatePlayerStats = vi.fn().mockResolvedValue(undefined)
const mockGetPlayerStats = vi.fn()

vi.mock("../../src/database/client", () => ({
  DatabaseClient: vi.fn().mockImplementation(() => ({
    getOrCreatePlayer: mockGetOrCreatePlayer,
    updatePlayerStats: mockUpdatePlayerStats,
    getPlayerStats: mockGetPlayerStats,
  })),
}))

describe("PlayerHandler", () => {
  let handler: PlayerHandler
  let db: DatabaseClient

  beforeEach(() => {
    vi.clearAllMocks()
    db = new DatabaseClient()
    handler = new PlayerHandler(db)

    // Default player stats
    mockGetPlayerStats.mockResolvedValue({
      playerId: 123,
      skill: 1000,
      kills: 0,
      deaths: 0,
      suicides: 0,
      teamkills: 0,
      kill_streak: 0,
      death_streak: 0,
    })
  })

  describe("handleEvent", () => {
    it("should handle PLAYER_CONNECT events", async () => {
      const event = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          steamId: "76561198000000000",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.100",
          country: "US",
        },
      } as PlayerConnectEvent

      const result = await handler.handleEvent(event)

      expect(result.success).toBe(true)
      expect(result.playersAffected).toEqual([123])
      expect(result.error).toBeUndefined()
      expect(mockUpdatePlayerStats).toHaveBeenCalledWith(123, {
        connection_time: 0,
      })
    })

    it("should handle PLAYER_DISCONNECT events", async () => {
      const event = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          reason: "Disconnect by user",
          sessionDuration: 1800,
        },
      } as PlayerDisconnectEvent

      const result = await handler.handleEvent(event)

      expect(result.success).toBe(true)
      expect(result.playersAffected).toEqual([123])
      expect(mockUpdatePlayerStats).toHaveBeenCalledWith(123, {
        connection_time: 1800,
      })
    })

    it("should handle PLAYER_KILL events with skill calculation", async () => {
      mockGetPlayerStats
        .mockResolvedValueOnce({ playerId: 123, skill: 1200, kill_streak: 2, death_streak: 0 }) // killer
        .mockResolvedValueOnce({ playerId: 456, skill: 1000, kill_streak: 0, death_streak: 1 }) // victim

      const event = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "ak47",
          headshot: true,
          killerTeam: "CT",
          victimTeam: "T",
        },
      } as PlayerKillEvent

      const result = await handler.handleEvent(event)

      expect(result.success).toBe(true)
      expect(result.playersAffected).toEqual([123, 456])

      // Check killer update
      expect(mockUpdatePlayerStats).toHaveBeenCalledWith(123, {
        kills: 1,
        headshots: 1,
        skill: expect.any(Number),
        kill_streak: 3,
        death_streak: 0,
      })

      // Check victim update
      expect(mockUpdatePlayerStats).toHaveBeenCalledWith(456, {
        deaths: 1,
        skill: expect.any(Number),
        death_streak: 2,
        kill_streak: 0,
      })
    })

    it("should handle PLAYER_SUICIDE events", async () => {
      mockGetPlayerStats.mockResolvedValueOnce({
        playerId: 123,
        skill: 1000,
        kill_streak: 5,
        death_streak: 0,
      })

      const event = {
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          weapon: "world",
          team: "CT",
        },
      } as PlayerSuicideEvent

      const result = await handler.handleEvent(event)

      expect(result.success).toBe(true)
      expect(result.playersAffected).toEqual([123])

      expect(mockUpdatePlayerStats).toHaveBeenCalledWith(123, {
        suicides: 1,
        deaths: 1,
        skill: 995,
        death_streak: 1,
        kill_streak: 0,
      })
    })

    it("should handle PLAYER_TEAMKILL events", async () => {
      mockGetPlayerStats
        .mockResolvedValueOnce({ playerId: 123, skill: 1000, kill_streak: 3, death_streak: 0 }) // killer
        .mockResolvedValueOnce({ playerId: 456, skill: 1000, kill_streak: 0, death_streak: 0 }) // victim

      const event = {
        eventType: EventType.PLAYER_TEAMKILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "m4a1",
          headshot: false,
          team: "CT",
        },
      } as PlayerTeamkillEvent

      const result = await handler.handleEvent(event)

      expect(result.success).toBe(true)
      expect(result.playersAffected).toEqual([123, 456])

      // Check killer update (teamkill penalty & teamkills count)
      expect(mockUpdatePlayerStats).toHaveBeenCalledWith(123, {
        teamkills: 1,
        skill: 990,
      })

      // Check victim update (death + skill compensation)
      expect(mockUpdatePlayerStats).toHaveBeenCalledWith(456, {
        deaths: 1,
        skill: expect.any(Number),
        death_streak: 1,
        kill_streak: 0,
      })
    })

    it("should not let skill go below 100", async () => {
      mockGetPlayerStats.mockResolvedValueOnce({
        playerId: 123,
        skill: 105,
        kill_streak: 0,
        death_streak: 10,
      })

      const event = {
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          weapon: "world",
          team: "T",
        },
      } as PlayerSuicideEvent

      const result = await handler.handleEvent(event)

      expect(result.success).toBe(true)

      expect(mockUpdatePlayerStats).toHaveBeenCalledWith(123, {
        suicides: 1,
        deaths: 1,
        skill: 100,
        death_streak: 11,
        kill_streak: 0,
      })
    })

    it("should return success for unhandled event types", async () => {
      const event = {
        eventType: EventType.MAP_CHANGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          previousMap: "de_dust2",
          newMap: "de_inferno",
          playerCount: 10,
        },
      } as MapChangeEvent

      const result = await handler.handleEvent(event)

      expect(result.success).toBe(true)
      expect(result.playersAffected).toBeUndefined()
    })

    describe("Error Handling", () => {
      it("should return success:false if connect handling fails", async () => {
        const connectError = new Error("DB connect error")
        mockGetOrCreatePlayer.mockRejectedValueOnce(connectError)
        const event = {
          eventType: EventType.PLAYER_CONNECT,
          data: {},
        } as PlayerConnectEvent
        const result = await handler.handleEvent(event)
        expect(result.success).toBe(false)
        expect(result.error).toBe("DB connect error")
      })

      it("should return success:false if disconnect handling fails", async () => {
        const event = {
          eventType: EventType.PLAYER_DISCONNECT,
          data: { playerId: -1 },
        } as PlayerDisconnectEvent
        const result = await handler.handleEvent(event)
        expect(result.success).toBe(false)
        expect(result.error).toBe("Test disconnect error")
      })

      it("should return success:false if killer stats update fails", async () => {
        const updateError = new Error("DB update error")
        mockUpdatePlayerStats.mockRejectedValueOnce(updateError)
        const event = {
          eventType: EventType.PLAYER_KILL,
          data: { killerId: 1, victimId: 2 },
        } as PlayerKillEvent
        const result = await handler.handleEvent(event)
        expect(result.success).toBe(false)
        expect(result.error).toBe("DB update error")
        // Ensure it fails on the first update and doesn't proceed
        expect(mockUpdatePlayerStats).toHaveBeenCalledTimes(1)
      })

      it("should return success:false if suicide player not found", async () => {
        mockGetPlayerStats.mockResolvedValueOnce(null)
        const event = {
          eventType: EventType.PLAYER_SUICIDE,
          data: { playerId: 999 },
        } as PlayerSuicideEvent
        const result = await handler.handleEvent(event)
        expect(result.success).toBe(false)
        expect(result.error).toBe("Player not found: 999")
      })

      it("should return success:false if teamkill players not found", async () => {
        mockGetPlayerStats.mockResolvedValueOnce(null)
        const event = {
          eventType: EventType.PLAYER_TEAMKILL,
          data: { killerId: 1, victimId: 2 },
        } as PlayerTeamkillEvent
        const result = await handler.handleEvent(event)
        expect(result.success).toBe(false)
        expect(result.error).toBe("Failed to fetch player stats")
      })
    })
  })
})
