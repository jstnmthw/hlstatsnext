/**
 * EventProcessor Unit Tests
 */

import type { BaseEvent } from "@/shared/types/events"
import type { AppContext } from "@/context"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerService } from "@/modules/player/player.types"
import type { IWeaponService } from "@/modules/weapon/weapon.types"
import type { IActionService } from "@/modules/action/action.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import { EventType } from "@/shared/types/events"
import { EventProcessor } from "./event-processor"
import { IServerService } from "@/modules/server/server.types"
import { createMockLogger } from "../../test-support/mocks/logger"
import { IGameDetectionService } from "@/modules/game/game-detection.types"
import { describe, it, expect, beforeEach, vi, type MockedFunction } from "vitest"
import { mockDeep as deepMock } from "vitest-mock-extended"
import { DatabaseClient } from "@/database/client"
import { IIngressService } from "@/modules/ingress/ingress.types"

describe("EventProcessor", () => {
  let eventProcessor: EventProcessor
  let mockContext: AppContext
  let mockLogger: ReturnType<typeof createMockLogger>

  // Store mock functions as variables for easy access
  let mockHandlePlayerEvent: MockedFunction<IPlayerService["handlePlayerEvent"]>
  let mockHandleKillEvent: MockedFunction<IPlayerService["handleKillEvent"]>

  beforeEach(() => {
    mockLogger = createMockLogger()

    // Create clean mock services using native vi.fn() for better control
    mockHandlePlayerEvent = vi.fn().mockResolvedValue({ success: true })
    mockHandleKillEvent = vi.fn().mockResolvedValue({ success: true })
    const playerServiceMock = {
      handlePlayerEvent: mockHandlePlayerEvent,
      handleKillEvent: mockHandleKillEvent,
    } as unknown as IPlayerService

    const matchServiceMock = {
      handleMatchEvent: vi.fn().mockResolvedValue({ success: true }),
      handleObjectiveEvent: vi.fn().mockResolvedValue({ success: true }),
      handleKillInMatch: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as IMatchService

    const weaponServiceMock = {
      handleWeaponEvent: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as IWeaponService

    const rankingServiceMock = {
      handleRatingUpdate: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as IRankingService

    const actionServiceMock = {
      handleActionEvent: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as IActionService

    // Use deepMock for services that don't need specific method access
    const gameDetectionServiceMock = deepMock<IGameDetectionService>()
    const serverServiceMock = deepMock<IServerService>()
    const databaseMock = deepMock<DatabaseClient>()
    const ingressServiceMock = deepMock<IIngressService>()

    mockContext = {
      logger: mockLogger,
      playerService: playerServiceMock,
      matchService: matchServiceMock,
      weaponService: weaponServiceMock,
      rankingService: rankingServiceMock,
      actionService: actionServiceMock,
      gameDetectionService: gameDetectionServiceMock,
      serverService: serverServiceMock,
      database: databaseMock,
      ingressService: ingressServiceMock,
    }

    eventProcessor = new EventProcessor(mockContext)
  })

  describe("EventProcessor instantiation", () => {
    it("should create processor instance", () => {
      expect(eventProcessor).toBeDefined()
      expect(eventProcessor).toBeInstanceOf(EventProcessor)
    })

    it("should store logger from context", () => {
      expect((eventProcessor as unknown as { logger: typeof mockLogger }).logger).toBe(mockLogger)
    })
  })

  describe("processEvent - Player Events", () => {
    it("should handle PLAYER_CONNECT events", async () => {
      const playerConnectEvent: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 1,
          steamId: "76561198000000000",
          playerName: "TestPlayer",
          ipAddress: "192.168.1.100",
        },
      }

      await eventProcessor.processEvent(playerConnectEvent)

      expect(mockContext.playerService.handlePlayerEvent).toHaveBeenCalledWith(playerConnectEvent)
      expect(mockLogger.debug).toHaveBeenCalledWith("Processing event: PLAYER_CONNECT for server 1")
      expect(mockLogger.debug).toHaveBeenCalledWith("Event processed successfully: PLAYER_CONNECT")
    })

    it("should handle PLAYER_DISCONNECT events", async () => {
      const playerDisconnectEvent: BaseEvent = {
        eventType: EventType.PLAYER_DISCONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 1,
          reason: "timeout",
        },
      }

      await eventProcessor.processEvent(playerDisconnectEvent)

      expect(mockContext.playerService.handlePlayerEvent).toHaveBeenCalledWith(
        playerDisconnectEvent,
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Processing event: PLAYER_DISCONNECT for server 1",
      )
    })

    it("should handle CHAT_MESSAGE events", async () => {
      const chatEvent: BaseEvent = {
        eventType: EventType.CHAT_MESSAGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 1,
          message: "Hello World",
          channel: "all",
        },
      }

      await eventProcessor.processEvent(chatEvent)

      expect(mockContext.playerService.handlePlayerEvent).toHaveBeenCalledWith(chatEvent)
    })
  })

  describe("processEvent - Kill Events", () => {
    it("should handle PLAYER_KILL events with multiple service calls", async () => {
      const killEvent: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: {
          killerId: 1,
          victimId: 2,
          weapon: "ak47",
          headshot: true,
          damage: 100,
        },
      }

      await eventProcessor.processEvent(killEvent)

      expect(mockContext.playerService.handleKillEvent).toHaveBeenCalledWith(killEvent)
      expect(mockContext.weaponService.handleWeaponEvent).toHaveBeenCalledWith(killEvent)
      expect(mockContext.rankingService.handleRatingUpdate).toHaveBeenCalled()
      expect(mockContext.matchService.handleKillInMatch).toHaveBeenCalledWith(killEvent)
    })

    it("should handle kill event failures gracefully", async () => {
      const killEvent: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        data: { killerId: 1, victimId: 2 },
      }

      const error = new Error("Player service failed")
      mockHandleKillEvent.mockRejectedValue(error)

      await expect(eventProcessor.processEvent(killEvent)).rejects.toThrow("Player service failed")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to process event PLAYER_KILL: Error: Player service failed",
      )
    })
  })

  describe("processEvent - Match Events", () => {
    it("should handle ROUND_START events", async () => {
      const roundStartEvent: BaseEvent = {
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: {
          roundNumber: 1,
          timelimit: 115,
        },
      }

      await eventProcessor.processEvent(roundStartEvent)

      expect(mockContext.matchService.handleMatchEvent).toHaveBeenCalledWith(roundStartEvent)
    })

    it("should handle ROUND_END events", async () => {
      const roundEndEvent: BaseEvent = {
        eventType: EventType.ROUND_END,
        timestamp: new Date(),
        serverId: 1,
        data: {
          roundNumber: 1,
          winner: "ct",
          duration: 89.5,
        },
      }

      await eventProcessor.processEvent(roundEndEvent)

      expect(mockContext.matchService.handleMatchEvent).toHaveBeenCalledWith(roundEndEvent)
    })

    it("should handle TEAM_WIN events", async () => {
      const teamWinEvent: BaseEvent = {
        eventType: EventType.TEAM_WIN,
        timestamp: new Date(),
        serverId: 1,
        data: {
          winningTeam: "ct",
          finalScore: { ct: 16, terrorist: 14 },
        },
      }

      await eventProcessor.processEvent(teamWinEvent)

      expect(mockContext.matchService.handleMatchEvent).toHaveBeenCalledWith(teamWinEvent)
    })

    it("should handle MAP_CHANGE events", async () => {
      const mapChangeEvent: BaseEvent = {
        eventType: EventType.MAP_CHANGE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          previousMap: "de_dust2",
          newMap: "de_inferno",
        },
      }

      await eventProcessor.processEvent(mapChangeEvent)

      expect(mockContext.matchService.handleMatchEvent).toHaveBeenCalledWith(mapChangeEvent)
    })
  })

  describe("processEvent - Objective Events", () => {
    it("should handle BOMB_PLANT events", async () => {
      const bombPlantEvent: BaseEvent = {
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 1,
          site: "A",
        },
      }

      await eventProcessor.processEvent(bombPlantEvent)

      expect(mockContext.matchService.handleObjectiveEvent).toHaveBeenCalledWith(bombPlantEvent)
    })

    it("should handle BOMB_DEFUSE events", async () => {
      const bombDefuseEvent: BaseEvent = {
        eventType: EventType.BOMB_DEFUSE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 2,
          site: "A",
          timeRemaining: 5.2,
        },
      }

      await eventProcessor.processEvent(bombDefuseEvent)

      expect(mockContext.matchService.handleObjectiveEvent).toHaveBeenCalledWith(bombDefuseEvent)
    })

    it("should handle all flag events", async () => {
      const flagEvents = [
        EventType.FLAG_CAPTURE,
        EventType.FLAG_DEFEND,
        EventType.FLAG_PICKUP,
        EventType.FLAG_DROP,
      ]

      for (const eventType of flagEvents) {
        const flagEvent: BaseEvent = {
          eventType,
          timestamp: new Date(),
          serverId: 1,
          data: { playerId: 1, flagId: 1 },
        }

        await eventProcessor.processEvent(flagEvent)

        expect(mockContext.matchService.handleObjectiveEvent).toHaveBeenCalledWith(flagEvent)
      }
    })

    it("should handle control point events", async () => {
      const controlPointEvents = [EventType.CONTROL_POINT_CAPTURE, EventType.CONTROL_POINT_DEFEND]

      for (const eventType of controlPointEvents) {
        const controlEvent: BaseEvent = {
          eventType,
          timestamp: new Date(),
          serverId: 1,
          data: { playerId: 1, controlPointId: 3 },
        }

        await eventProcessor.processEvent(controlEvent)

        expect(mockContext.matchService.handleObjectiveEvent).toHaveBeenCalledWith(controlEvent)
      }
    })
  })

  describe("processEvent - Weapon Events", () => {
    it("should handle WEAPON_FIRE events", async () => {
      const weaponFireEvent: BaseEvent = {
        eventType: EventType.WEAPON_FIRE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 1,
          weapon: "ak47",
          ammo: 29,
        },
      }

      await eventProcessor.processEvent(weaponFireEvent)

      expect(mockContext.weaponService.handleWeaponEvent).toHaveBeenCalledWith(weaponFireEvent)
    })

    it("should handle WEAPON_HIT events", async () => {
      const weaponHitEvent: BaseEvent = {
        eventType: EventType.WEAPON_HIT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          attackerId: 1,
          victimId: 2,
          weapon: "m4a1",
          damage: 27,
          bodypart: "chest",
        },
      }

      await eventProcessor.processEvent(weaponHitEvent)

      expect(mockContext.weaponService.handleWeaponEvent).toHaveBeenCalledWith(weaponHitEvent)
    })
  })

  describe("processEvent - Action Events", () => {
    it("should handle all action event types", async () => {
      const actionEvents = [
        EventType.ACTION_PLAYER,
        EventType.ACTION_PLAYER_PLAYER,
        EventType.ACTION_TEAM,
        EventType.ACTION_WORLD,
      ]

      for (const eventType of actionEvents) {
        const actionEvent: BaseEvent = {
          eventType,
          timestamp: new Date(),
          serverId: 1,
          data: { playerId: 1, actionCode: "test" },
        }

        await eventProcessor.processEvent(actionEvent)

        expect(mockContext.actionService.handleActionEvent).toHaveBeenCalledWith(actionEvent)
      }
    })
  })

  describe("processEvent - System Events", () => {
    it("should handle SERVER_STATS_UPDATE events", async () => {
      const serverStatsEvent: BaseEvent = {
        eventType: EventType.SERVER_STATS_UPDATE,
        timestamp: new Date(),
        serverId: 1,
        data: { players: 10, rounds: 5 },
      }

      await eventProcessor.processEvent(serverStatsEvent)

      expect(mockLogger.debug).toHaveBeenCalledWith("Server stats update event for server 1")
    })

    it("should handle SERVER_SHUTDOWN events", async () => {
      const shutdownEvent: BaseEvent = {
        eventType: EventType.SERVER_SHUTDOWN,
        timestamp: new Date(),
        serverId: 1,
        data: { reason: "restart" },
      }

      await eventProcessor.processEvent(shutdownEvent)

      expect(mockLogger.info).toHaveBeenCalledWith("System event: SERVER_SHUTDOWN")
    })

    it("should handle ADMIN_ACTION events", async () => {
      const adminActionEvent: BaseEvent = {
        eventType: EventType.ADMIN_ACTION,
        timestamp: new Date(),
        serverId: 1,
        data: { adminId: 1, action: "kick_player" },
      }

      await eventProcessor.processEvent(adminActionEvent)

      expect(mockLogger.info).toHaveBeenCalledWith("System event: ADMIN_ACTION")
    })

    it("should handle unknown event types", async () => {
      const unknownEvent: BaseEvent = {
        eventType: "UNKNOWN_EVENT" as EventType,
        timestamp: new Date(),
        serverId: 1,
        data: {},
      }

      await eventProcessor.processEvent(unknownEvent)

      expect(mockLogger.warn).toHaveBeenCalledWith("Unhandled event type: UNKNOWN_EVENT")
    })
  })

  describe("processEvents - Sequential Processing", () => {
    it("should process multiple events in sequence", async () => {
      const events: BaseEvent[] = [
        {
          eventType: EventType.PLAYER_CONNECT,
          timestamp: new Date(),
          serverId: 1,
          data: { playerId: 1 },
        },
        {
          eventType: EventType.WEAPON_FIRE,
          timestamp: new Date(),
          serverId: 1,
          data: { playerId: 1, weapon: "ak47" },
        },
        {
          eventType: EventType.ROUND_START,
          timestamp: new Date(),
          serverId: 1,
          data: { roundNumber: 1 },
        },
      ]

      await eventProcessor.processEvents(events)

      expect(mockContext.playerService.handlePlayerEvent).toHaveBeenCalledTimes(1)
      expect(mockContext.weaponService.handleWeaponEvent).toHaveBeenCalledTimes(1)
      expect(mockContext.matchService.handleMatchEvent).toHaveBeenCalledTimes(1)
    })

    it("should stop processing on error and propagate it", async () => {
      const events: BaseEvent[] = [
        {
          eventType: EventType.PLAYER_CONNECT,
          timestamp: new Date(),
          serverId: 1,
          data: { playerId: 1 },
        },
        {
          eventType: EventType.WEAPON_FIRE,
          timestamp: new Date(),
          serverId: 1,
          data: { playerId: 1, weapon: "ak47" },
        },
      ]

      const error = new Error("Processing failed")
      mockHandlePlayerEvent.mockRejectedValue(error)

      await expect(eventProcessor.processEvents(events)).rejects.toThrow("Processing failed")

      // Second event should not be processed due to error
      expect(mockContext.weaponService.handleWeaponEvent).not.toHaveBeenCalled()
    })

    it("should handle empty event array", async () => {
      await eventProcessor.processEvents([])

      expect(mockLogger.info).not.toHaveBeenCalled()
    })
  })

  describe("processEventsConcurrent - Concurrent Processing", () => {
    it("should process events with default concurrency", async () => {
      const events: BaseEvent[] = Array.from({ length: 5 }, (_, i) => ({
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: i + 1 },
      }))

      await eventProcessor.processEventsConcurrent(events)

      expect(mockContext.playerService.handlePlayerEvent).toHaveBeenCalledTimes(5)
    })

    it("should process events with custom concurrency limit", async () => {
      const events: BaseEvent[] = Array.from({ length: 15 }, (_, i) => ({
        eventType: EventType.WEAPON_FIRE,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: i + 1, weapon: "ak47" },
      }))

      await eventProcessor.processEventsConcurrent(events, 3)

      expect(mockContext.weaponService.handleWeaponEvent).toHaveBeenCalledTimes(15)
    })

    it("should handle concurrent processing errors", async () => {
      const events: BaseEvent[] = Array.from({ length: 3 }, (_, i) => ({
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: i + 1 },
      }))

      const error = new Error("Concurrent processing failed")
      mockHandlePlayerEvent.mockRejectedValue(error)

      await expect(eventProcessor.processEventsConcurrent(events, 2)).rejects.toThrow(
        "Concurrent processing failed",
      )
    })

    it("should process remaining events after batch completion", async () => {
      const events: BaseEvent[] = Array.from({ length: 7 }, (_, i) => ({
        eventType: EventType.ACTION_PLAYER,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: i + 1, actionCode: "test" },
      }))

      await eventProcessor.processEventsConcurrent(events, 3)

      expect(mockContext.actionService.handleActionEvent).toHaveBeenCalledTimes(7)
    })

    it("should handle empty concurrent event array", async () => {
      await eventProcessor.processEventsConcurrent([])

      expect(mockLogger.info).not.toHaveBeenCalled()
    })
  })

  describe("Error handling and edge cases", () => {
    it("should handle service method not found gracefully", async () => {
      // Remove a service method by setting to undefined
      // @ts-expect-error - This is a test
      mockContext.playerService.handlePlayerEvent = undefined

      const playerEvent: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 1 },
      }

      await expect(eventProcessor.processEvent(playerEvent)).rejects.toThrow()
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to process event PLAYER_CONNECT"),
      )
    })

    it("should handle events with missing data", async () => {
      const incompleteEvent: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        // Missing data field
      }

      await eventProcessor.processEvent(incompleteEvent)

      expect(mockContext.playerService.handleKillEvent).toHaveBeenCalledWith(incompleteEvent)
    })

    it("should handle events with null/undefined values", async () => {
      const eventWithNulls: BaseEvent = {
        eventType: EventType.WEAPON_FIRE,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: null,
          weapon: undefined,
          ammo: 0,
        },
      }

      await eventProcessor.processEvent(eventWithNulls)

      expect(mockContext.weaponService.handleWeaponEvent).toHaveBeenCalledWith(eventWithNulls)
    })

    it("should handle very large event batches", async () => {
      const largeEventBatch: BaseEvent[] = Array.from({ length: 1000 }, (_, i) => ({
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: i + 1 },
      }))

      await eventProcessor.processEventsConcurrent(largeEventBatch, 50)

      expect(mockContext.playerService.handlePlayerEvent).toHaveBeenCalledTimes(1000)
    })
  })
})
