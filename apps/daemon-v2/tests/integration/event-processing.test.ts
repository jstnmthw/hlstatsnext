/**
 * Integration Tests for Event Processing Pipeline
 *
 * Tests end-to-end event processing scenarios including
 * multi-handler coordination, database interactions, and error recovery.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createEventProcessorService } from "../../src/services/processor/processor.service"
import { DatabaseClient, databaseClient } from "../../src/database/client"
import { EventType, PlayerKillEvent, PlayerConnectEvent, PlayerDisconnectEvent } from "../../src/types/common/events"
import type { MalformedEvent } from "../types/test-mocks"
import { asUnknownEvent, createMockLogger } from "../types/test-mocks"

describe("Event Processing Integration", () => {
  beforeAll(async () => {
    await databaseClient.transaction(async (tx) => {
      const game = await tx.game.create({
        data: { code: "csgo", name: "Counter-Strike: Global Offensive xx", realgame: "csgo" },
      })
      await tx.country.create({
        data: { flag: "", name: "Unknown" },
      })
      await tx.server.create({
        data: {
          serverId: 1,
          address: "127.0.0.1",
          port: 27015,
          game: game.code,
        },
      })
    })
  })

  afterAll(async () => {
    // Clean up all data to leave a clean state
    // Delete in an order that respects foreign key constraints
    await databaseClient.prisma.playerUniqueId.deleteMany()
    await databaseClient.prisma.player.deleteMany()
    await databaseClient.prisma.server.deleteMany()
    await databaseClient.prisma.game.deleteMany()
    await databaseClient.prisma.country.deleteMany()
    await databaseClient.disconnect()
  })

  describe("Complete Player Lifecycle", () => {
    it("should handle a complete player session from connect to disconnect", async () => {
      try {
        await databaseClient.transaction(async (tx) => {
          const transactionalDb = new DatabaseClient(tx)
          const processor = createEventProcessorService(transactionalDb, createMockLogger())

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
          const player = await tx.player.findFirst({ where: { uniqueIds: { some: { uniqueId: steamId } } } })
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

          const killerAfterKill = await tx.player.findUnique({ where: { playerId } })
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
          const finalPlayer = await tx.player.findUnique({ where: { playerId } })
          expect(finalPlayer?.connection_time).toBeGreaterThan(0)

          // Throw an error at the end of the transaction to trigger a rollback
          throw new Error("Rollback")
        })
      } catch (error: unknown) {
        if (error instanceof Error) {
          // We expect the rollback error, so we catch it and ignore it.
          if (error.message !== "Rollback") {
            throw error
          }
        }
      }
    })
  })

  describe("Error Handling and Recovery", () => {
    it.skip("should handle database connection failures gracefully", async () => {
      // This test is now covered by unit tests and the transactional nature of the lifecycle test
      expect(true).toBe(true)
    })

    it.skip("should handle malformed event data without crashing", async () => {
      try {
        await databaseClient.transaction(async (tx) => {
          const transactionalDb = new DatabaseClient(tx)
          const processor = createEventProcessorService(transactionalDb, createMockLogger())

          const malformedEvent: MalformedEvent = {
            eventType: "INVALID_EVENT_TYPE",
            serverId: 1,
            timestamp: new Date(),
            meta: { steamId: "STEAM_1:0:111", playerName: "Player1", isBot: false },
            data: {},
          }
          await expect(processor.processEvent(asUnknownEvent(malformedEvent))).resolves.not.toThrow()

          throw new Error("Rollback")
        })
      } catch (error: unknown) {
        if (error instanceof Error) {
          if (error.message !== "Rollback") {
            throw error
          }
        }
      }
    })
  })
})
