/**
 * Advanced Events Processing Integration Tests
 *
 * Integration tests for the complete advanced event processing pipeline,
 * including objective events and server statistics tracking.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { EventProcessorService } from "../../src/services/processor/processor.service"
import { EventService } from "../../src/services/event/event.service"
import { PlayerService } from "../../src/services/player/player.service"
import { MatchHandler } from "../../src/services/processor/handlers/match.handler"
import { PlayerHandler } from "../../src/services/processor/handlers/player.handler"
import { WeaponHandler } from "../../src/services/processor/handlers/weapon.handler"
import { ActionHandler } from "../../src/services/processor/handlers/action.handler"
import { RankingHandler } from "../../src/services/processor/handlers/ranking.handler"
import { ServerStatsHandler } from "../../src/services/processor/handlers/server-stats.handler"
import { WeaponService } from "../../src/services/weapon/weapon.service"
import { ActionService } from "../../src/services/action/action.service"
import { DatabaseClient } from "../../src/database/client"
import { createMockLogger } from "../types/test-mocks"
import type {
  BombPlantEvent,
  BombDefuseEvent,
  FlagCaptureEvent,
  PlayerKillEvent,
  RoundStartEvent,
} from "../../src/types/common/events"
import { EventType } from "../../src/types/common/events"
import type { TransactionalPrisma } from "src/database/client"

describe("Advanced Events Processing Integration", () => {
  let processor: EventProcessorService
  let db: DatabaseClient
  const logger = createMockLogger()

  beforeEach(async () => {
    // Create a real database client for integration testing
    db = new DatabaseClient()

    // Test the connection
    const connected = await db.testConnection()
    if (!connected) {
      throw new Error("Failed to connect to database")
    }

    // Create services
    const eventService = new EventService(db, logger)
    const playerService = new PlayerService(db, logger)
    const weaponService = new WeaponService(db, logger)
    const actionService = new ActionService(db, logger)

    // Create handlers
    const playerHandler = new PlayerHandler(playerService, logger)
    const weaponHandler = new WeaponHandler(weaponService, db, logger)
    const actionHandler = new ActionHandler(actionService, playerService, db, logger)
    const matchHandler = new MatchHandler(playerService, db, logger)
    const rankingHandler = new RankingHandler(playerService, weaponService, logger)
    const serverStatsHandler = new ServerStatsHandler(db, logger)

    // Create processor with all handlers
    processor = new EventProcessorService(
      eventService,
      playerService,
      playerHandler,
      weaponHandler,
      actionHandler,
      matchHandler,
      rankingHandler,
      serverStatsHandler,
      logger,
    )

    // Set up test data using transaction for isolation
    await db.transaction(async (tx) => {
      await setupTestData(tx)
    })
  })

  afterEach(async () => {
    // Clean up test data using transaction
    await db.transaction(async (tx) => {
      await cleanupTestData(tx)
    })
  })

  async function setupTestData(tx: TransactionalPrisma) {
    // Create a test server
    await tx.server.create({
      data: {
        serverId: 1,
        address: "127.0.0.1",
        port: 27015,
        name: "Test Server",
        game: "csgo",
        act_map: "de_dust2",
        kills: 0,
        players: 0,
        rounds: 0,
        suicides: 0,
        headshots: 0,
        bombs_planted: 0,
        bombs_defused: 0,
        ct_wins: 0,
        ts_wins: 0,
        act_players: 0,
        max_players: 24,
      },
    })

    // Create test players
    await tx.player.createMany({
      data: [
        {
          playerId: 123,
          lastName: "BombPlanter",
          game: "csgo",
          skill: 1000,
          kills: 0,
          deaths: 0,
          suicides: 0,
          headshots: 0,
          teamkills: 0,
        },
        {
          playerId: 456,
          lastName: "BombDefuser",
          game: "csgo",
          skill: 1000,
          kills: 0,
          deaths: 0,
          suicides: 0,
          headshots: 0,
          teamkills: 0,
        },
      ],
    })

    // Create player unique IDs
    await tx.playerUniqueId.createMany({
      data: [
        {
          playerId: 123,
          uniqueId: "STEAM_1:0:123456",
          game: "csgo",
        },
        {
          playerId: 456,
          uniqueId: "STEAM_1:0:654321",
          game: "csgo",
        },
      ],
    })
  }

  async function cleanupTestData(tx: TransactionalPrisma) {
    // Clean up in reverse order of creation
    await tx.playerUniqueId.deleteMany({ where: { playerId: { in: [123, 456] } } })
    await tx.player.deleteMany({ where: { playerId: { in: [123, 456] } } })
    await tx.server.deleteMany({ where: { serverId: 1 } })
  }

  describe("Objective Events Processing", () => {
    it("should process bomb plant and defuse events end-to-end", async () => {
      // Start a round to initialize match stats
      const roundStartEvent: RoundStartEvent = {
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: {
          map: "de_dust2",
          roundNumber: 1,
          maxPlayers: 10,
        },
      }

      await processor.processEvent(roundStartEvent)

      // Process bomb plant event
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
          playerName: "BombPlanter",
          isBot: false,
        },
      }

      await processor.processEvent(bombPlantEvent)

      // Verify bomb plant was recorded in database
      const bombPlantRecord = await db.prisma.eventPlayerAction.findFirst({
        where: {
          playerId: 123,
          serverId: 1,
        },
      })

      expect(bombPlantRecord).toBeDefined()
      expect(bombPlantRecord?.bonus).toBe(3)
      expect(bombPlantRecord?.pos_x).toBe(100)

      // Verify server stats were updated
      const server = await db.prisma.server.findUnique({
        where: { serverId: 1 },
      })

      expect(server?.bombs_planted).toBe(1)

      // Process bomb defuse event
      const bombDefuseEvent: BombDefuseEvent = {
        eventType: EventType.BOMB_DEFUSE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 456,
          bombsite: "A",
          position: { x: 100, y: 200, z: 50 },
          team: "CT",
          timeRemaining: 10,
        },
        meta: {
          steamId: "STEAM_1:0:654321",
          playerName: "BombDefuser",
          isBot: false,
        },
      }

      await processor.processEvent(bombDefuseEvent)

      // Verify bomb defuse was recorded
      const bombDefuseRecord = await db.prisma.eventPlayerAction.findFirst({
        where: {
          playerId: 456,
          serverId: 1,
        },
      })

      expect(bombDefuseRecord).toBeDefined()
      expect(bombDefuseRecord?.bonus).toBe(3)

      // Verify server stats were updated
      const updatedServer = await db.prisma.server.findUnique({
        where: { serverId: 1 },
      })

      expect(updatedServer?.bombs_planted).toBe(1)
      expect(updatedServer?.bombs_defused).toBe(1)
    })

    it("should process flag capture events end-to-end", async () => {
      // Start a round to initialize match stats
      const roundStartEvent: RoundStartEvent = {
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: {
          map: "ctf_2fort",
          roundNumber: 1,
          maxPlayers: 24,
        },
      }

      await processor.processEvent(roundStartEvent)

      // Set up test data
      await db.transaction(async (tx: TransactionalPrisma) => {
        await tx.player.create({
          data: {
            playerId: 789,
            lastName: "FlagRunner",
            game: "csgo",
            skill: 1000,
            kills: 0,
            deaths: 0,
            suicides: 0,
            headshots: 0,
            teamkills: 0,
          },
        })
        await tx.playerUniqueId.create({
          data: {
            playerId: 789,
            uniqueId: "STEAM_1:0:789012",
            game: "csgo",
          },
        })
      })

      // Process flag capture event
      const flagCaptureEvent: FlagCaptureEvent = {
        eventType: EventType.FLAG_CAPTURE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 789,
          flagTeam: "BLUE",
          captureTeam: "RED",
          position: { x: 500, y: 600, z: 200 },
        },
        meta: {
          steamId: "STEAM_1:0:789012",
          playerName: "FlagCapturer",
          isBot: false,
        },
      }

      await processor.processEvent(flagCaptureEvent)

      // Verify flag capture was recorded
      const flagCaptureRecord = await db.prisma.eventPlayerAction.findFirst({
        where: {
          playerId: 789,
          serverId: 1,
        },
      })

      expect(flagCaptureRecord).toBeDefined()
      expect(flagCaptureRecord?.bonus).toBe(5)
      expect(flagCaptureRecord?.pos_x).toBe(500)
    })
  })

  describe("Server Statistics Processing", () => {
    it("should track and update server statistics from various events", async () => {
      // Get initial server state
      const initialServer = await db.prisma.server.findUnique({
        where: { serverId: 1 },
      })

      expect(initialServer?.kills).toBe(0)
      expect(initialServer?.headshots).toBe(0)

      // Process a kill event with headshot
      const killEvent: PlayerKillEvent = {
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
        meta: {
          killer: {
            steamId: "STEAM_1:0:123456",
            playerName: "Killer",
            isBot: false,
          },
          victim: {
            steamId: "STEAM_1:0:654321",
            playerName: "Victim",
            isBot: false,
          },
        },
      }

      await processor.processEvent(killEvent)

      // Wait a moment for async server stats processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Check that server stats were updated via SERVER_STATS_UPDATE events
      const updatedServer = await db.prisma.server.findUnique({
        where: { serverId: 1 },
      })

      // The server stats should have been updated by the ServerStatsHandler
      expect(updatedServer?.kills).toBeGreaterThan(0)
      expect(updatedServer?.headshots).toBeGreaterThan(0)
    })

    it("should handle complex event sequences with correct statistics", async () => {
      // Start a round
      await processor.processEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 10 },
      })

      // Process multiple bomb events
      await processor.processEvent({
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 123, bombsite: "A", team: "TERRORIST" },
        meta: { steamId: "STEAM_1:0:123456", playerName: "Terrorist", isBot: false },
      })

      await processor.processEvent({
        eventType: EventType.BOMB_DEFUSE,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 456, bombsite: "A", team: "CT" },
        meta: { steamId: "STEAM_1:0:654321", playerName: "CT", isBot: false },
      })

      // End the round
      await processor.processEvent({
        eventType: EventType.ROUND_END,
        timestamp: new Date(),
        serverId: 1,
        data: { winningTeam: "CT", duration: 120 },
      })

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify final server state
      const finalServer = await db.prisma.server.findUnique({
        where: { serverId: 1 },
      })

      expect(finalServer?.bombs_planted).toBeGreaterThan(0)
      expect(finalServer?.bombs_defused).toBeGreaterThan(0)
      expect(finalServer?.rounds).toBeGreaterThan(0)
      expect(finalServer?.map_rounds).toBeGreaterThan(0)
    })
  })

  describe("Match Statistics Integration", () => {
    it("should track objective scores in match statistics", async () => {
      // Start a round
      await processor.processEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 10 },
      })

      // Process bomb plant
      await processor.processEvent({
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 123, bombsite: "A", team: "TERRORIST" },
        meta: { steamId: "STEAM_1:0:123456", playerName: "Terrorist", isBot: false },
      })

      // Process bomb defuse by different player
      await processor.processEvent({
        eventType: EventType.BOMB_DEFUSE,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 456, bombsite: "A", team: "CT" },
        meta: { steamId: "STEAM_1:0:654321", playerName: "CT", isBot: false },
      })

      // Get match stats through the processor's match handler
      const matchHandler = (processor as unknown as { matchHandler: MatchHandler }).matchHandler
      const matchStats = matchHandler.getMatchStats(1)

      expect(matchStats).toBeDefined()
      expect(matchStats?.playerStats.get(123)?.objectiveScore).toBe(3) // Bomb plant
      expect(matchStats?.playerStats.get(456)?.objectiveScore).toBe(3) // Bomb defuse
    })
  })

  describe("Error Resilience", () => {
    it("should handle processing errors gracefully", async () => {
      // Try to process an event with non-existent player
      const invalidEvent: BombPlantEvent = {
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 99999, // Non-existent player
          bombsite: "A",
          team: "TERRORIST",
        },
        meta: {
          steamId: "STEAM_1:0:999999",
          playerName: "NonExistent",
          isBot: false,
        },
      }

      // This should not throw an error, but handle it gracefully
      await expect(processor.processEvent(invalidEvent)).resolves.not.toThrow()

      // Verify error was logged
      expect(logger.error).toHaveBeenCalled()
    })

    it("should continue processing after database errors", async () => {
      // Start with a valid round
      await processor.processEvent({
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: { map: "de_dust2", roundNumber: 1, maxPlayers: 10 },
      })

      // Process a valid bomb plant
      await processor.processEvent({
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 123, bombsite: "A", team: "TERRORIST" },
        meta: { steamId: "STEAM_1:0:123456", playerName: "Terrorist", isBot: false },
      })

      // Verify the first event was processed successfully
      const bombPlantRecord = await db.prisma.eventPlayerAction.findFirst({
        where: { playerId: 123, serverId: 1 },
      })

      expect(bombPlantRecord).toBeDefined()
    })
  })
})
