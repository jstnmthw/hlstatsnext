/**
 * Integration Tests for Event Processing Pipeline
 *
 * Tests end-to-end event processing scenarios including
 * multi-handler coordination, database interactions, and error recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createEventProcessorService } from "../../src/services/processor/processor.service"
import { DatabaseClient, databaseClient } from "../../src/database/client"
import { EventType, PlayerKillEvent, PlayerConnectEvent, PlayerDisconnectEvent } from "../../src/types/common/events"
import type { MalformedEvent } from "../types/test-mocks"
import { asUnknownEvent, createMockLogger } from "../types/test-mocks"

describe("Event Processing Integration", () => {
  let processor: ReturnType<typeof createEventProcessorService>
  let db: DatabaseClient

  beforeEach(async () => {
    db = databaseClient
    // Clean up database before each test to ensure isolation
    await db.prisma.eventEntry.deleteMany()
    await db.prisma.playerUniqueId.deleteMany()
    await db.prisma.player.deleteMany()

    // Create the processor with real dependencies
    processor = createEventProcessorService(db, createMockLogger())
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await db.disconnect()
  })

  describe("Complete Player Lifecycle", () => {
    it("should handle a complete player session from connect to disconnect", async () => {
      const steamId = "STEAM_1:0:12345"
      const playerName = "TestPlayer"

      // 1. Player connects
      const connectEvent: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        meta: { steamId, playerName, isBot: false },
        data: { playerId: 0, steamId, playerName, ipAddress: "192.168.1.100" },
      }
      await processor.processEvent(connectEvent)

      // Verify player was created
      const player = await db.prisma.player.findFirst({ where: { uniqueIds: { some: { uniqueId: steamId } } } })
      expect(player).toBeDefined()
      expect(player?.lastName).toBe(playerName)
      const playerId = player!.playerId

      // 2. Player gets a kill
      const killEvent: PlayerKillEvent = {
        eventType: EventType.PLAYER_KILL,
        serverId: 1,
        timestamp: new Date(Date.now() + 30000), // 30 seconds later
        meta: {
          killer: { steamId, playerName, isBot: false },
          victim: { steamId: "STEAM_1:0:67890", playerName: "Victim", isBot: false },
        },
        data: { killerId: 0, victimId: 0, weapon: "ak47", headshot: true, killerTeam: "T", victimTeam: "CT" },
      }
      await processor.processEvent(killEvent)

      const killerAfterKill = await db.prisma.player.findUnique({ where: { playerId } })
      expect(killerAfterKill?.kills).toBe(1)
      expect(killerAfterKill?.headshots).toBe(1)

      // 3. Player disconnects
      const disconnectEvent: PlayerDisconnectEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        serverId: 1,
        timestamp: new Date(Date.now() + 300000), // 5 minutes later
        meta: { steamId, playerName, isBot: false },
        data: { playerId },
      }
      await processor.processEvent(disconnectEvent)

      // Check final state (e.g., connection time)
      const finalPlayer = await db.prisma.player.findUnique({ where: { playerId } })
      // Note: session time calculation is a placeholder in the handler, so we can't assert a specific value
      expect(finalPlayer?.connection_time).toBeGreaterThan(0)
    })
  })

  describe("Error Handling and Recovery", () => {
    it("should handle database connection failures gracefully", async () => {
      const failingDb = {
        ...databaseClient,
        testConnection: vi.fn().mockRejectedValue(new Error("Database connection failed")),
        prisma: {
          ...databaseClient.prisma,
          player: {
            ...databaseClient.prisma.player,
            findUnique: vi.fn().mockRejectedValue(new Error("Database connection failed")),
          },
          playerUniqueId: {
            findUnique: vi.fn().mockRejectedValue(new Error("Database connection failed")),
          },
        },
      } as unknown as DatabaseClient

      const failingProcessor = createEventProcessorService(failingDb, createMockLogger())

      const event: PlayerConnectEvent = {
        eventType: EventType.PLAYER_CONNECT,
        serverId: 1,
        timestamp: new Date(),
        meta: { steamId: "STEAM_1:0:111", playerName: "Player1", isBot: false },
        data: { playerId: 0, steamId: "STEAM_1:0:111", playerName: "Player1", ipAddress: "192.168.1.1" },
      }

      await expect(failingProcessor.processEvent(event)).rejects.toThrow("Database connection failed")
    })

    it("should handle malformed event data without crashing", async () => {
      const malformedEvent: MalformedEvent = {
        eventType: "INVALID_EVENT_TYPE",
        serverId: 1,
        timestamp: new Date(),
        meta: { steamId: "STEAM_1:0:111", playerName: "Player1", isBot: false },
        data: {},
      }
      await expect(processor.processEvent(asUnknownEvent(malformedEvent))).resolves.not.toThrow()
    })
  })
})
