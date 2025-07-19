/**
 * Server Statistics Handler Tests
 *
 * Tests for the ServerStatsHandler that tracks server-level statistics
 * and generates SERVER_STATS_UPDATE events.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { ServerStatsHandler } from "../../../src/services/processor/handlers/server-stats.handler"
import { createMockLogger, createMockDatabaseClient } from "../../types/test-mocks"
import type {
  PlayerKillEvent,
  PlayerSuicideEvent,
  BombPlantEvent,
  BombDefuseEvent,
  TeamWinEvent,
  RoundEndEvent,
  MapChangeEvent,
  PlayerConnectEvent,
  PlayerDisconnectEvent,
} from "../../../src/types/common/events"
import { EventType } from "../../../src/types/common/events"

describe("ServerStatsHandler", () => {
  let handler: ServerStatsHandler
  let mockDatabase: ReturnType<typeof createMockDatabaseClient>
  const loggerMock = createMockLogger()

  beforeEach(() => {
    vi.clearAllMocks()
    mockDatabase = createMockDatabaseClient()
    handler = new ServerStatsHandler(mockDatabase as unknown as DatabaseClient, loggerMock)
  })

  describe("Kill Events", () => {
    it("should track kill statistics", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "ak47",
          headshot: false,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      await handler.handleEvent(killEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.SERVER_STATS_UPDATE,
          serverId: 1,
          data: expect.objectContaining({
            kills: 1,
          }),
        }),
      )
    })

    it("should track headshot statistics", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      const headshotKillEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 123,
          victimId: 456,
          weapon: "ak47",
          headshot: true,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      await handler.handleEvent(headshotKillEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kills: 1,
            headshots: 1,
          }),
        }),
      )
    })
  })

  describe("Suicide Events", () => {
    it("should track suicide statistics", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      const suicideEvent: PlayerSuicideEvent = {
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          weapon: "world",
          team: "TERRORIST",
        },
      }

      await handler.handleEvent(suicideEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            suicides: 1,
          }),
        }),
      )
    })
  })

  describe("Bomb Events", () => {
    it("should track bomb plant statistics", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

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

      await handler.handleEvent(bombPlantEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bombsPlanted: 1,
          }),
        }),
      )
    })

    it("should track bomb defuse statistics", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      const bombDefuseEvent: BombDefuseEvent = {
        eventType: EventType.BOMB_DEFUSE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 456,
          bombsite: "A",
          team: "CT",
        },
      }

      await handler.handleEvent(bombDefuseEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bombsDefused: 1,
          }),
        }),
      )
    })
  })

  describe("Team Win Events", () => {
    it("should track CT wins", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      const teamWinEvent: TeamWinEvent = {
        eventType: EventType.TEAM_WIN,
        timestamp: new Date(),
        serverId: 1,
        data: {
          winningTeam: "CT",
          triggerName: "CTs_Win",
          score: { ct: 16, t: 14 },
        },
      }

      await handler.handleEvent(teamWinEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ctWins: 1,
          }),
        }),
      )
    })

    it("should track Terrorist wins", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      const teamWinEvent: TeamWinEvent = {
        eventType: EventType.TEAM_WIN,
        timestamp: new Date(),
        serverId: 1,
        data: {
          winningTeam: "TERRORIST",
          triggerName: "Terrorists_Win",
          score: { ct: 14, t: 16 },
        },
      }

      await handler.handleEvent(teamWinEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tsWins: 1,
          }),
        }),
      )
    })
  })

  describe("Round Events", () => {
    it("should track round completion", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      const roundEndEvent: RoundEndEvent = {
        eventType: EventType.ROUND_END,
        timestamp: new Date(),
        serverId: 1,
        data: {
          winningTeam: "CT",
          duration: 120,
        },
      }

      await handler.handleEvent(roundEndEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rounds: 1,
            mapRounds: 1,
          }),
        }),
      )
    })
  })

  describe("Map Change Events", () => {
    it("should track map changes", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      const mapChangeEvent: MapChangeEvent = {
        eventType: EventType.MAP_CHANGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          previousMap: "de_dust2",
          newMap: "de_mirage",
          playerCount: 10,
        },
      }

      await handler.handleEvent(mapChangeEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mapChanges: 1,
            mapStarted: expect.any(Number),
            actMap: "de_mirage",
          }),
        }),
      )
    })
  })

  describe("Player Count Events", () => {
    it("should track player connections", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      // Mock current server state
      vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValueOnce({
        serverId: 1,
        act_players: 5,
        max_players: 10,
        // ... other server fields
      })

      const connectEvent: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          steamId: "STEAM_1:0:123456",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.1",
        },
      }

      await handler.handleEvent(connectEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            players: 1,
            actPlayers: 6, // 5 + 1
          }),
        }),
      )
    })

    it("should track player disconnections", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      // Mock current server state
      vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValueOnce({
        serverId: 1,
        act_players: 5,
        max_players: 10,
        // ... other server fields
      })

      const disconnectEvent: PlayerDisconnectEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          reason: "Disconnect",
        },
      }

      await handler.handleEvent(disconnectEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actPlayers: 4, // 5 - 1
          }),
        }),
      )
    })

    it("should update max players when current exceeds maximum", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      // Mock current server state where we're at max capacity
      vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValueOnce({
        serverId: 1,
        act_players: 10,
        max_players: 10,
        // ... other server fields
      })

      const connectEvent: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 123,
          steamId: "STEAM_1:0:123456",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.1",
        },
      }

      await handler.handleEvent(connectEvent)

      expect(statsUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            players: 1,
            actPlayers: 11,
            maxPlayers: 11, // Updated to new maximum
          }),
        }),
      )
    })
  })

  describe("getServerStats", () => {
    it("should retrieve current server statistics", async () => {
      const mockServerData = {
        serverId: 1,
        kills: 100,
        players: 50,
        rounds: 25,
        suicides: 5,
        headshots: 30,
        bombs_planted: 12,
        bombs_defused: 8,
        ct_wins: 13,
        ts_wins: 12,
        act_players: 10,
        max_players: 24,
        act_map: "de_dust2",
        map_rounds: 5,
        map_ct_wins: 3,
        map_ts_wins: 2,
        map_started: 1640995200,
        map_changes: 1,
        ct_shots: 500,
        ct_hits: 125,
        ts_shots: 600,
        ts_hits: 150,
        map_ct_shots: 100,
        map_ct_hits: 25,
        map_ts_shots: 120,
        map_ts_hits: 30,
      }

      vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValueOnce(mockServerData)

      const stats = await handler.getServerStats(1)

      expect(stats).toEqual({
        serverId: 1,
        timestamp: expect.any(Date),
        kills: 100,
        players: 50,
        rounds: 25,
        suicides: 5,
        headshots: 30,
        bombsPlanted: 12,
        bombsDefused: 8,
        ctWins: 13,
        tsWins: 12,
        actPlayers: 10,
        maxPlayers: 24,
        actMap: "de_dust2",
        mapRounds: 5,
        mapCtWins: 3,
        mapTsWins: 2,
        mapStarted: 1640995200,
        mapChanges: 1,
        ctShots: 500,
        ctHits: 125,
        tsShots: 600,
        tsHits: 150,
        mapCtShots: 100,
        mapCtHits: 25,
        mapTsShots: 120,
        mapTsHits: 30,
      })
    })

    it("should return null for non-existent server", async () => {
      vi.mocked(mockDatabase.prisma.server.findUnique).mockResolvedValueOnce(null)

      const stats = await handler.getServerStats(999)

      expect(stats).toBeNull()
    })

    it("should handle database errors gracefully", async () => {
      vi.mocked(mockDatabase.prisma.server.findUnique).mockRejectedValueOnce(new Error("Database error"))

      const stats = await handler.getServerStats(1)

      expect(stats).toBeNull()
      expect(loggerMock.error).toHaveBeenCalledWith(
        "Failed to get server stats for server 1: Error: Database error",
      )
    })
  })

  describe("generateStatsUpdateEvent", () => {
    it("should generate a properly formatted ServerStatsUpdateEvent", () => {
      const deltaStats = {
        kills: 1,
        headshots: 1,
        bombsPlanted: 1,
      }

      const event = handler.generateStatsUpdateEvent(1, deltaStats)

      expect(event).toEqual({
        eventType: EventType.SERVER_STATS_UPDATE,
        timestamp: expect.any(Date),
        serverId: 1,
        data: {
          kills: 1,
          headshots: 1,
          bombsPlanted: 1,
          players: undefined,
          rounds: undefined,
          suicides: undefined,
          bombsDefused: undefined,
          ctWins: undefined,
          tsWins: undefined,
          actPlayers: undefined,
          maxPlayers: undefined,
          actMap: undefined,
          mapRounds: undefined,
          mapCtWins: undefined,
          mapTsWins: undefined,
          mapStarted: undefined,
          mapChanges: undefined,
          ctShots: undefined,
          ctHits: undefined,
          tsShots: undefined,
          tsHits: undefined,
          mapCtShots: undefined,
          mapCtHits: undefined,
          mapTsShots: undefined,
          mapTsHits: undefined,
        },
      })
    })
  })

  describe("Callback Management", () => {
    it("should register and unregister stats update callbacks", () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      handler.onStatsUpdate(callback1)
      handler.onStatsUpdate(callback2)

      // Trigger an update
      handler.handleEvent({
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 123, team: "TERRORIST" },
      })

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()

      // Reset mocks and remove one callback
      vi.clearAllMocks()
      handler.offStatsUpdate(callback1)

      // Trigger another update
      handler.handleEvent({
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 123, team: "TERRORIST" },
      })

      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })

    it("should handle callback errors gracefully", async () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error("Callback error")
      })
      const goodCallback = vi.fn()

      handler.onStatsUpdate(errorCallback)
      handler.onStatsUpdate(goodCallback)

      await handler.handleEvent({
        eventType: EventType.PLAYER_SUICIDE,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 123, team: "TERRORIST" },
      })

      expect(errorCallback).toHaveBeenCalled()
      expect(goodCallback).toHaveBeenCalled()
      expect(loggerMock.error).toHaveBeenCalledWith(
        "Error in stats update callback: Error: Callback error",
      )
    })
  })

  describe("Unhandled Events", () => {
    it("should ignore events not relevant to server stats", async () => {
      const statsUpdateCallback = vi.fn()
      handler.onStatsUpdate(statsUpdateCallback)

      await handler.handleEvent({
        eventType: EventType.CHAT_MESSAGE,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 123, message: "Hello", team: "TERRORIST", isDead: false },
      })

      expect(statsUpdateCallback).not.toHaveBeenCalled()
    })
  })
})
