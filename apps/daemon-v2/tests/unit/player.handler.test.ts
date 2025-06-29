import { describe, it, expect, beforeEach, vi } from "vitest"
import { PlayerHandler } from "../../src/services/processor/handlers/player.handler"
import { createMockLogger, createMockPlayer } from "../types/test-mocks"
import type { IPlayerService } from "../../src/services/player/player.types"
import {
  EventType,
  PlayerConnectEvent,
  PlayerDisconnectEvent,
  PlayerKillEvent,
  PlayerSuicideEvent,
  PlayerTeamkillEvent,
  MapChangeEvent,
} from "../../src/types/common/events"

// Helper to build a mock IPlayerService
const createPlayerServiceMock = (): IPlayerService => ({
  getOrCreatePlayer: vi.fn(),
  updatePlayerStats: vi.fn(),
  getPlayerStats: vi.fn(),
  getPlayerRating: vi.fn(),
  updatePlayerRatings: vi.fn(),
  getRoundParticipants: vi.fn(),
  getTopPlayers: vi.fn(),
})

describe("PlayerHandler", () => {
  let handler: PlayerHandler
  let mockPlayerService: IPlayerService
  const loggerMock = createMockLogger()

  beforeEach(() => {
    vi.clearAllMocks()
    mockPlayerService = createPlayerServiceMock()

    // Use dependency injection
    handler = new PlayerHandler(mockPlayerService, loggerMock)

    // Default player stats
    vi.mocked(mockPlayerService.getPlayerStats).mockResolvedValue(createMockPlayer())
  })

  describe("handleEvent", () => {
    it("should handle PLAYER_CONNECT events", async () => {
      vi.mocked(mockPlayerService.getOrCreatePlayer).mockResolvedValue(123)

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
      expect(mockPlayerService.getOrCreatePlayer).toHaveBeenCalledWith("76561198000000000", "TestPlayer", "csgo")
      expect(mockPlayerService.updatePlayerStats).toHaveBeenCalledWith(123, {
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
      expect(mockPlayerService.updatePlayerStats).toHaveBeenCalledWith(123, {
        connection_time: 1800,
      })
    })

    it("should handle PLAYER_KILL events with skill calculation", async () => {
      vi.mocked(mockPlayerService.getPlayerStats)
        .mockResolvedValueOnce(createMockPlayer({ playerId: 123, skill: 1200, kill_streak: 2, death_streak: 0 })) // killer
        .mockResolvedValueOnce(createMockPlayer({ playerId: 456, skill: 1000, kill_streak: 0, death_streak: 1 })) // victim
      vi.mocked(mockPlayerService.getPlayerRating)
        .mockResolvedValueOnce({ playerId: 123, rating: 1200, confidence: 350, volatility: 0.06, gamesPlayed: 10 }) // killer
        .mockResolvedValueOnce({ playerId: 456, rating: 1000, confidence: 350, volatility: 0.06, gamesPlayed: 10 }) // victim

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
      expect(mockPlayerService.updatePlayerStats).toHaveBeenCalledWith(123, {
        kills: 1,
        headshots: 1,
        skill: expect.any(Number),
        kill_streak: 3,
        death_streak: 0,
      })

      // Check victim update
      expect(mockPlayerService.updatePlayerStats).toHaveBeenCalledWith(456, {
        deaths: 1,
        skill: expect.any(Number),
        death_streak: 2,
        kill_streak: 0,
      })
    })

    it("should handle PLAYER_SUICIDE events", async () => {
      vi.mocked(mockPlayerService.getPlayerStats).mockResolvedValueOnce(
        createMockPlayer({
          playerId: 123,
          skill: 1000,
          kill_streak: 5,
          death_streak: 0,
        }),
      )

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

      expect(mockPlayerService.updatePlayerStats).toHaveBeenCalledWith(123, {
        suicides: 1,
        deaths: 1,
        skill: 995,
        death_streak: 1,
        kill_streak: 0,
      })
    })

    it("should handle PLAYER_TEAMKILL events", async () => {
      vi.mocked(mockPlayerService.getPlayerStats)
        .mockResolvedValueOnce(createMockPlayer({ playerId: 123, skill: 1000, kill_streak: 3, death_streak: 0 })) // killer
        .mockResolvedValueOnce(createMockPlayer({ playerId: 456, skill: 1000, kill_streak: 0, death_streak: 0 })) // victim

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

      // Check killer update (teamkill penalty & reset kill_streak)
      expect(mockPlayerService.updatePlayerStats).toHaveBeenCalledWith(123, {
        teamkills: 1,
        skill: 990,
        kill_streak: 0,
      })

      // Check victim update (death + death_streak increment + reset kill_streak)
      expect(mockPlayerService.updatePlayerStats).toHaveBeenCalledWith(456, {
        deaths: 1,
        death_streak: 1,
        kill_streak: 0,
      })
    })

    it("should not let skill go below 100", async () => {
      vi.mocked(mockPlayerService.getPlayerStats).mockResolvedValueOnce(
        createMockPlayer({
          playerId: 123,
          skill: 105,
          kill_streak: 0,
          death_streak: 10,
        }),
      )

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

      expect(mockPlayerService.updatePlayerStats).toHaveBeenCalledWith(123, {
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
        vi.mocked(mockPlayerService.getOrCreatePlayer).mockRejectedValueOnce(connectError)
        const event = {
          eventType: EventType.PLAYER_CONNECT,
          timestamp: new Date(),
          serverId: 1,
          data: {
            steamId: "76561198000000000",
            playerName: "TestPlayer",
          },
        } as PlayerConnectEvent
        const result = await handler.handleEvent(event)
        expect(result.success).toBe(false)
        expect(result.error).toBe("DB connect error")
        expect(loggerMock.error).toHaveBeenCalled()
      })

      it("should return success:false if disconnect handling fails", async () => {
        const event = {
          eventType: EventType.PLAYER_DISCONNECT,
          timestamp: new Date(),
          serverId: 1,
          data: { playerId: -1 },
        } as PlayerDisconnectEvent
        const result = await handler.handleEvent(event)
        expect(result.success).toBe(false)
        expect(result.error).toBe("Test disconnect error")
        expect(loggerMock.error).toHaveBeenCalled()
      })

      it("should return success:false if killer stats update fails", async () => {
        const updateError = new Error("DB update error")
        vi.mocked(mockPlayerService.getPlayerStats)
          .mockResolvedValueOnce(createMockPlayer({ playerId: 123, skill: 1000, kill_streak: 0, death_streak: 0 })) // killer
          .mockResolvedValueOnce(createMockPlayer({ playerId: 456, skill: 1000, kill_streak: 0, death_streak: 0 })) // victim
        vi.mocked(mockPlayerService.updatePlayerStats).mockRejectedValueOnce(updateError)
        const event = {
          eventType: EventType.PLAYER_KILL,
          timestamp: new Date(),
          serverId: 1,
          data: { killerId: 123, victimId: 456, weapon: "ak47", headshot: false },
        } as PlayerKillEvent
        const result = await handler.handleEvent(event)
        expect(result.success).toBe(false)
        expect(result.error).toBe("DB update error")
        // Ensure it fails on the first update and doesn't proceed
        expect(mockPlayerService.updatePlayerStats).toHaveBeenCalledTimes(1)
        expect(loggerMock.error).toHaveBeenCalled()
      })

      it("should return success:false if suicide player not found", async () => {
        vi.mocked(mockPlayerService.getPlayerStats).mockResolvedValueOnce(null)
        const event = {
          eventType: EventType.PLAYER_SUICIDE,
          timestamp: new Date(),
          serverId: 1,
          data: { playerId: 999, weapon: "world", team: "CT" },
        } as PlayerSuicideEvent
        const result = await handler.handleEvent(event)
        expect(result.success).toBe(false)
        expect(result.error).toBe("Player not found: 999")
        expect(loggerMock.error).toHaveBeenCalled()
      })

      it("should return success:false if teamkill players not found", async () => {
        vi.mocked(mockPlayerService.getPlayerStats).mockResolvedValueOnce(null) // First call returns null (killer not found)
        const event = {
          eventType: EventType.PLAYER_TEAMKILL,
          timestamp: new Date(),
          serverId: 1,
          data: { killerId: 123, victimId: 456, weapon: "m4a1", headshot: false, team: "CT" },
        } as PlayerTeamkillEvent
        const result = await handler.handleEvent(event)
        expect(result.success).toBe(false)
        expect(result.error).toBe("Could not find killer or victim player records")
        expect(loggerMock.error).toHaveBeenCalled()
      })
    })
  })

  describe("Logging", () => {
    it("should emit an EVENT log when a kill is successfully recorded", async () => {
      vi.mocked(mockPlayerService.getPlayerStats)
        .mockResolvedValueOnce(createMockPlayer({ playerId: 1, skill: 1000 }))
        .mockResolvedValueOnce(createMockPlayer({ playerId: 2, skill: 1000 }))
      vi.mocked(mockPlayerService.getPlayerRating)
        .mockResolvedValueOnce({ playerId: 1, rating: 1000, confidence: 350, volatility: 0.06, gamesPlayed: 10 })
        .mockResolvedValueOnce({ playerId: 2, rating: 1000, confidence: 350, volatility: 0.06, gamesPlayed: 10 })

      const event: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: false,
          killerTeam: "CT",
          victimTeam: "T",
        },
      }

      await handler.handleEvent(event)

      expect(loggerMock.event).toHaveBeenCalledWith("Kill recorded: Player 1 killed Player 2 with ak47")
    })
  })
})
