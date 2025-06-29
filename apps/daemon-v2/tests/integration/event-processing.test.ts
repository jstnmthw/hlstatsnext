/**
 * Integration Tests for Event Processing Pipeline
 *
 * Tests end-to-end event processing scenarios including
 * multi-handler coordination, database interactions, and error recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventProcessorService } from "../../src/services/processor/processor.service"
import { DatabaseClient } from "../../src/database/client"
import { EventService } from "../../src/services/event/event.service"
import { PlayerService } from "../../src/services/player/player.service"
import { WeaponService } from "../../src/services/weapon/weapon.service"
import {
  EventType,
  PlayerKillEvent,
  PlayerConnectEvent,
  PlayerDisconnectEvent,
  PlayerSuicideEvent,
  PlayerTeamkillEvent,
  PlayerChatEvent,
} from "../../src/types/common/events"
import type { MalformedEvent } from "../types/test-mocks"
import { asUnknownEvent } from "../types/test-mocks"

// Mock all dependencies
vi.mock("../../src/database/client")
vi.mock("../../src/services/event/event.service")
vi.mock("../../src/services/player/player.service")
vi.mock("../../src/services/weapon/weapon.service")
vi.mock("../../src/services/processor/handlers/player.handler")
vi.mock("../../src/services/processor/handlers/weapon.handler")
vi.mock("../../src/services/processor/handlers/match.handler")
vi.mock("../../src/services/processor/handlers/ranking.handler")

const MockedDatabaseClient = vi.mocked(DatabaseClient)
const MockedEventService = vi.mocked(EventService)
const MockedPlayerService = vi.mocked(PlayerService)
const MockedWeaponService = vi.mocked(WeaponService)

describe("Event Processing Integration", () => {
  let processor: EventProcessorService
  let mockDb: DatabaseClient
  let mockEventService: EventService
  let mockPlayerService: PlayerService
  let mockWeaponService: WeaponService

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock database
    mockDb = {
      testConnection: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn().mockImplementation((callback) => callback({})),
      prisma: {
        player: {
          update: vi.fn().mockResolvedValue({}),
          upsert: vi.fn().mockResolvedValue({}),
        },
        eventFrag: {
          create: vi.fn().mockResolvedValue({}),
        },
      },
    } as unknown as DatabaseClient

    // Setup mock services
    mockEventService = {
      createGameEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as EventService

    mockPlayerService = {
      getOrCreatePlayer: vi.fn().mockResolvedValue(1),
      updatePlayerStats: vi.fn().mockResolvedValue(undefined),
      getPlayerStats: vi.fn().mockResolvedValue(null),
      getTopPlayers: vi.fn().mockResolvedValue([]),
    } as unknown as PlayerService

    mockWeaponService = {
      getWeaponModifier: vi.fn().mockResolvedValue(1.0),
    } as unknown as WeaponService

    // Mock the constructor calls
    MockedDatabaseClient.mockImplementation(() => mockDb)
    MockedEventService.mockImplementation(() => mockEventService)
    MockedPlayerService.mockImplementation(() => mockPlayerService)
    MockedWeaponService.mockImplementation(() => mockWeaponService)

    processor = new EventProcessorService(mockDb)
  })

  describe("Complete Player Lifecycle", () => {
    it("should handle a complete player session from connect to disconnect", async () => {
      const playerId = 1
      const steamId = "STEAM_1:0:12345"
      const playerName = "TestPlayer"

      // 1. Player connects
      const connectEvent: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        meta: { steamId, playerName, isBot: false },
        data: {
          playerId,
          steamId,
          playerName,
          ipAddress: "192.168.1.100",
        },
      }

      // 2. Player gets some kills
      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(Date.now() + 30000), // 30 seconds later
        meta: {
          killer: { steamId, playerName, isBot: false },
          victim: { steamId: "STEAM_1:0:67890", playerName: "Victim", isBot: false },
        },
        data: {
          killerId: playerId,
          victimId: 2,
          weapon: "ak47",
          headshot: true,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      // 3. Player sends chat message
      const chatEvent: PlayerChatEvent = {
        eventType: EventType.CHAT_MESSAGE,
        serverId: 1,
        timestamp: new Date(Date.now() + 60000), // 1 minute later
        meta: { steamId, playerName, isBot: false },
        data: {
          playerId,
          message: "Good game!",
          messageMode: 1,
          team: "TERRORIST",
          isDead: false,
        },
      }

      // 4. Player disconnects
      const disconnectEvent: PlayerDisconnectEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        serverId: 1,
        timestamp: new Date(Date.now() + 300000), // 5 minutes later
        meta: { steamId, playerName, isBot: false },
        data: { playerId },
      }

      // Process all events in sequence
      await processor.processEvent(connectEvent)
      await processor.processEvent(killEvent)
      await processor.processEvent(chatEvent)
      await processor.processEvent(disconnectEvent)

      // Verify service interactions
      expect(mockPlayerService.getOrCreatePlayer).toHaveBeenCalledWith(steamId, playerName, "cstrike")
      expect(mockEventService.createGameEvent).toHaveBeenCalledTimes(4)
    })

    it("should handle bot players correctly when logging is disabled", async () => {
      const botProcessor = new EventProcessorService(mockDb, { logBots: false })

      const botEvent: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        meta: { steamId: "BOT", playerName: "Bot_Player", isBot: true },
        data: {
          playerId: 0,
          steamId: "BOT",
          playerName: "Bot_Player",
          ipAddress: "0.0.0.0",
        },
      }

      await botProcessor.processEvent(botEvent)

      // Bot events should be ignored
      expect(mockPlayerService.getOrCreatePlayer).not.toHaveBeenCalled()
      expect(mockEventService.createGameEvent).not.toHaveBeenCalled()
    })
  })

  describe("Multi-Player Scenarios", () => {
    it("should handle rapid fire multiple player events", async () => {
      const events: (PlayerConnectEvent | PlayerKillEvent | PlayerTeamkillEvent)[] = [
        // Multiple players connect
        {
          eventType: EventType.PLAYER_CONNECT,
          serverId: 1,
          timestamp: new Date(),
          meta: { steamId: "STEAM_1:0:111", playerName: "Player1", isBot: false },
          data: { playerId: 1, steamId: "STEAM_1:0:111", playerName: "Player1", ipAddress: "192.168.1.1" },
        },
        {
          eventType: EventType.PLAYER_CONNECT,
          serverId: 1,
          timestamp: new Date(Date.now() + 1000),
          meta: { steamId: "STEAM_1:0:222", playerName: "Player2", isBot: false },
          data: { playerId: 2, steamId: "STEAM_1:0:222", playerName: "Player2", ipAddress: "192.168.1.2" },
        },
        // Players start fighting
        {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(Date.now() + 5000),
          meta: {
            killer: { steamId: "STEAM_1:0:111", playerName: "Player1", isBot: false },
            victim: { steamId: "STEAM_1:0:222", playerName: "Player2", isBot: false },
          },
          data: {
            killerId: 1,
            victimId: 2,
            weapon: "ak47",
            headshot: false,
            killerTeam: "TERRORIST",
            victimTeam: "CT",
          },
        },
        // Teamkill happens
        {
          eventType: EventType.PLAYER_TEAMKILL,
          serverId: 1,
          timestamp: new Date(Date.now() + 10000),
          meta: {
            killer: { steamId: "STEAM_1:0:111", playerName: "Player1", isBot: false },
            victim: { steamId: "STEAM_1:0:333", playerName: "Player3", isBot: false },
          },
          data: {
            killerId: 1,
            victimId: 3,
            weapon: "m4a1",
            headshot: false,
            team: "TERRORIST",
          },
        },
      ]

      // Process all events concurrently to test race conditions
      await Promise.all(events.map((event) => processor.processEvent(event)))

      expect(mockEventService.createGameEvent).toHaveBeenCalledTimes(4)
      expect(mockPlayerService.getOrCreatePlayer).toHaveBeenCalledTimes(6) // 2 connects + 4 event players (kill + teamkill each have 2 players)
    })

    it("should handle edge case event sequences", async () => {
      // Suicide followed by immediate disconnect
      const suicideEvent: PlayerSuicideEvent = {
        eventType: EventType.PLAYER_SUICIDE,
        serverId: 1,
        timestamp: new Date(),
        meta: { steamId: "STEAM_1:0:111", playerName: "Player1", isBot: false },
        data: {
          playerId: 1,
          weapon: "hegrenade",
          team: "TERRORIST",
        },
      }

      const disconnectEvent: PlayerDisconnectEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        serverId: 1,
        timestamp: new Date(Date.now() + 100), // Almost immediate
        meta: { steamId: "STEAM_1:0:111", playerName: "Player1", isBot: false },
        data: { playerId: 1 },
      }

      await processor.processEvent(suicideEvent)
      await processor.processEvent(disconnectEvent)

      expect(mockEventService.createGameEvent).toHaveBeenCalledTimes(2)
    })
  })

  describe("Error Handling and Recovery", () => {
    it("should handle database connection failures gracefully", async () => {
      // Mock PlayerService failure
      const failingPlayerService = {
        getOrCreatePlayer: vi.fn().mockRejectedValue(new Error("Database connection failed")),
      } as unknown as PlayerService

      // Mock the failing service
      MockedPlayerService.mockImplementation(() => failingPlayerService)

      const failingProcessor = new EventProcessorService(mockDb)

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        meta: { steamId: "STEAM_1:0:111", playerName: "Player1", isBot: false },
        data: {
          playerId: 1,
          steamId: "STEAM_1:0:111",
          playerName: "Player1",
          ipAddress: "192.168.1.1",
        },
      }

      // Should throw the database error
      await expect(failingProcessor.processEvent(event)).rejects.toThrow("Database connection failed")
    })

    it("should handle malformed event data", async () => {
      const malformedEvent: MalformedEvent = {
        eventType: "INVALID_EVENT_TYPE",
        serverId: 1,
        timestamp: new Date(),
        meta: { steamId: "STEAM_1:0:111", playerName: "Player1", isBot: false },
        data: {},
      }

      // Should not throw for unknown event types
      await expect(processor.processEvent(asUnknownEvent(malformedEvent))).resolves.not.toThrow()
    })

    it("should handle concurrent access to the same player", async () => {
      const steamId = "STEAM_1:0:111"
      const playerName = "ConcurrentPlayer"

      // Create multiple events for the same player happening simultaneously
      const concurrentEvents = Array.from({ length: 5 }, (_, i) => ({
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(Date.now() + i), // Nearly simultaneous
        meta: {
          killer: { steamId, playerName, isBot: false },
          victim: { steamId: `STEAM_1:0:${222 + i}`, playerName: `Victim${i}`, isBot: false },
        },
        data: {
          killerId: 1,
          victimId: i + 2,
          weapon: "ak47",
          headshot: i % 2 === 0,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      })) as PlayerKillEvent[]

      // Process all events concurrently
      await Promise.all(concurrentEvents.map((event) => processor.processEvent(event)))

      expect(mockEventService.createGameEvent).toHaveBeenCalledTimes(5)
    })
  })

  describe("Performance and Load Testing", () => {
    it("should handle high-frequency events efficiently", async () => {
      const highFrequencyEvents = Array.from({ length: 100 }, (_, i) => ({
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(Date.now() + i * 10), // Every 10ms
        meta: {
          killer: { steamId: `STEAM_1:0:${i % 10}`, playerName: `Player${i % 10}`, isBot: false },
          victim: { steamId: `STEAM_1:0:${(i % 10) + 100}`, playerName: `Victim${i % 10}`, isBot: false },
        },
        data: {
          killerId: i % 10,
          victimId: (i % 10) + 100,
          weapon: ["ak47", "m4a1", "awp"][i % 3],
          headshot: i % 4 === 0,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      })) as PlayerKillEvent[]

      const start = Date.now()
      await Promise.all(highFrequencyEvents.map((event) => processor.processEvent(event)))
      const duration = Date.now() - start

      // Should process 100 events in under 2 seconds
      expect(duration).toBeLessThan(2000)
      expect(mockEventService.createGameEvent).toHaveBeenCalledTimes(100)
    })

    it("should handle mixed event types efficiently", async () => {
      const mixedEvents: (PlayerConnectEvent | PlayerKillEvent)[] = []

      // Generate a mix of different event types
      for (let i = 0; i < 50; i++) {
        const baseTime = Date.now() + i * 100

        const connectEvent: PlayerConnectEvent = {
          eventType: EventType.PLAYER_CONNECT,
          serverId: 1,
          timestamp: new Date(baseTime),
          meta: { steamId: `STEAM_1:0:${i}`, playerName: `Player${i}`, isBot: false },
          data: { playerId: i, steamId: `STEAM_1:0:${i}`, playerName: `Player${i}`, ipAddress: "192.168.1.1" },
        }

        const killEvent: PlayerKillEvent = {
          eventType: EventType.PLAYER_KILL,
          serverId: 1,
          timestamp: new Date(baseTime + 50),
          meta: {
            killer: { steamId: `STEAM_1:0:${i}`, playerName: `Player${i}`, isBot: false },
            victim: { steamId: `STEAM_1:0:${i + 100}`, playerName: `Victim${i}`, isBot: false },
          },
          data: {
            killerId: i,
            victimId: i + 100,
            weapon: "ak47",
            headshot: true,
            killerTeam: "TERRORIST",
            victimTeam: "CT",
          },
        }

        mixedEvents.push(connectEvent, killEvent)
      }

      const start = Date.now()
      await Promise.all(mixedEvents.map((event) => processor.processEvent(event)))
      const duration = Date.now() - start

      // Should process 100 mixed events efficiently
      expect(duration).toBeLessThan(3000)
      expect(mockEventService.createGameEvent).toHaveBeenCalledTimes(100)
    })
  })

  describe("Data Consistency", () => {
    it("should maintain referential integrity across events", async () => {
      const killerId = 1
      const victimId = 2
      const killerSteamId = "STEAM_1:0:111"
      const victimSteamId = "STEAM_1:0:222"

      // Setup mock to return consistent player IDs
      mockPlayerService.getOrCreatePlayer = vi
        .fn()
        .mockResolvedValueOnce(killerId) // First call for killer
        .mockResolvedValueOnce(victimId) // Second call for victim

      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(),
        meta: {
          killer: { steamId: killerSteamId, playerName: "Killer", isBot: false },
          victim: { steamId: victimSteamId, playerName: "Victim", isBot: false },
        },
        data: {
          killerId,
          victimId,
          weapon: "ak47",
          headshot: true,
          killerTeam: "TERRORIST",
          victimTeam: "CT",
        },
      }

      await processor.processEvent(killEvent)

      // Verify correct player resolution
      expect(mockPlayerService.getOrCreatePlayer).toHaveBeenCalledWith(killerSteamId, "Killer", "cstrike")
      expect(mockPlayerService.getOrCreatePlayer).toHaveBeenCalledWith(victimSteamId, "Victim", "cstrike")

      // Verify event creation with correct player IDs
      expect(mockEventService.createGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          data: expect.objectContaining({
            killerId,
            victimId,
          }),
        }),
      )
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
})
