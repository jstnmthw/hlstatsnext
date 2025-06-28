import { describe, it, expect, beforeEach, vi } from "vitest"
import { PlayerHandler } from "../../src/services/processor/handlers/player.handler"
import {
  EventType,
  PlayerConnectEvent,
  PlayerDisconnectEvent,
  PlayerKillEvent,
  MapChangeEvent,
} from "../../src/types/common/events"
import { DatabaseClient } from "../../src/database/client"

const mockGetOrCreatePlayer = vi.fn().mockResolvedValue(123)
const mockUpdatePlayerStats = vi.fn().mockResolvedValue(undefined)

vi.mock("../../src/database/client", () => ({
  DatabaseClient: vi.fn().mockImplementation(() => ({
    getOrCreatePlayer: mockGetOrCreatePlayer,
    updatePlayerStats: mockUpdatePlayerStats,
  })),
}))

describe("PlayerHandler", () => {
  let handler: PlayerHandler
  let db: DatabaseClient

  beforeEach(() => {
    vi.clearAllMocks()
    db = new DatabaseClient()
    handler = new PlayerHandler(db)
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
    })

    it("should handle PLAYER_KILL events", async () => {
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

      it("should return success:false if victim stats update fails", async () => {
        const updateError = new Error("DB update error for victim")
        // First call for killer succeeds, second for victim fails
        mockUpdatePlayerStats.mockResolvedValueOnce(undefined).mockRejectedValueOnce(updateError)
        const event = {
          eventType: EventType.PLAYER_KILL,
          data: { killerId: 1, victimId: 2 },
        } as PlayerKillEvent
        const result = await handler.handleEvent(event)
        expect(result.success).toBe(false)
        expect(result.error).toBe("DB update error for victim")
        expect(mockUpdatePlayerStats).toHaveBeenCalledTimes(2)
      })
    })
  })
})
