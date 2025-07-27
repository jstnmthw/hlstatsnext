/**
 * EventProcessor Unit Tests
 */

import type { BaseEvent } from "@/shared/types/events"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerService } from "@/modules/player/player.types"
import type { IWeaponService } from "@/modules/weapon/weapon.types"
import type { IActionService } from "@/modules/action/action.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IServerService } from "@/modules/server/server.types"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import { EventType } from "@/shared/types/events"
import { EventProcessor, type EventProcessorDependencies } from "./event-processor"
import { createMockLogger } from "../../tests/mocks/logger"
import { describe, it, expect, beforeEach, vi, type MockedFunction } from "vitest"

describe("EventProcessor", () => {
  let eventProcessor: EventProcessor
  let mockEventBus: IEventBus
  let mockDependencies: EventProcessorDependencies
  let mockLogger: ReturnType<typeof createMockLogger>

  // Store mock functions as variables for easy access
  let mockHandlePlayerEvent: MockedFunction<IPlayerService["handlePlayerEvent"]>
  let mockHandleKillEvent: MockedFunction<IPlayerService["handleKillEvent"]>
  let mockGetOrCreatePlayer: MockedFunction<IPlayerService["getOrCreatePlayer"]>
  let mockGetServerGame: MockedFunction<IServerService["getServerGame"]>

  beforeEach(() => {
    mockLogger = createMockLogger()

    // Mock EventBus
    mockEventBus = {
      emit: vi.fn().mockResolvedValue(undefined),
      on: vi.fn().mockReturnValue("handler-id"),
      off: vi.fn(),
      clearHandlers: vi.fn(),
      getStats: vi.fn().mockReturnValue({
        totalHandlers: 0,
        handlersByType: new Map(),
        eventsEmitted: 0,
        errors: 0,
      }),
    }

    // Create clean mock services using native vi.fn() for better control
    mockHandlePlayerEvent = vi.fn().mockResolvedValue({ success: true })
    mockHandleKillEvent = vi.fn().mockResolvedValue({ success: true })
    mockGetOrCreatePlayer = vi.fn().mockResolvedValue(1)
    mockGetServerGame = vi.fn().mockResolvedValue("cs")

    const playerServiceMock = {
      handlePlayerEvent: mockHandlePlayerEvent,
      handleKillEvent: mockHandleKillEvent,
      getOrCreatePlayer: mockGetOrCreatePlayer,
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

    const serverServiceMock = {
      getServerGame: mockGetServerGame,
    } as unknown as IServerService

    mockDependencies = {
      playerService: playerServiceMock,
      matchService: matchServiceMock,
      weaponService: weaponServiceMock,
      rankingService: rankingServiceMock,
      actionService: actionServiceMock,
      serverService: serverServiceMock,
      logger: mockLogger,
    }

    eventProcessor = new EventProcessor(mockEventBus, mockDependencies)
  })

  describe("EventProcessor instantiation", () => {
    it("should create processor instance", () => {
      expect(eventProcessor).toBeDefined()
      expect(eventProcessor).toBeInstanceOf(EventProcessor)
    })

    it("should register event handlers with the event bus", () => {
      // Verify that the event bus .on method was called to register handlers
      expect(mockEventBus.on).toHaveBeenCalled()
      
      // Check that handlers were registered for various event types
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const registeredEventTypes = onCalls.map(call => call[0])
      
      expect(registeredEventTypes).toContain(EventType.PLAYER_CONNECT)
      expect(registeredEventTypes).toContain(EventType.PLAYER_KILL)
      expect(registeredEventTypes).toContain(EventType.ROUND_START)
      expect(registeredEventTypes).toContain(EventType.BOMB_PLANT)
      expect(registeredEventTypes).toContain(EventType.WEAPON_FIRE)
      expect(registeredEventTypes).toContain(EventType.ACTION_PLAYER)
    })

    it("should log registration of event handlers", () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("EventProcessor registered") 
      )
    })
  })

  describe("Event handling through EventBus", () => {
    it("should handle PLAYER_CONNECT events when emitted through event bus", async () => {
      // Get the registered handler for PLAYER_CONNECT
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const playerConnectCall = onCalls.find(call => call[0] === EventType.PLAYER_CONNECT)
      expect(playerConnectCall).toBeDefined()
      
      const handler = playerConnectCall![1]

      const playerConnectEvent: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        meta: {
          steamId: "76561198000000000",
          playerName: "TestPlayer",
        },
        data: {
          ipAddress: "192.168.1.100",
        },
      }

      await handler(playerConnectEvent)

      expect(mockDependencies.playerService.handlePlayerEvent).toHaveBeenCalled()
      expect(mockDependencies.serverService.getServerGame).toHaveBeenCalledWith(1)
      expect(mockDependencies.playerService.getOrCreatePlayer).toHaveBeenCalledWith(
        "76561198000000000",
        "TestPlayer", 
        "cs"
      )
    })

    it("should handle PLAYER_KILL events when emitted through event bus", async () => {
      // Get the registered handler for PLAYER_KILL
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const playerKillCall = onCalls.find(call => call[0] === EventType.PLAYER_KILL)
      expect(playerKillCall).toBeDefined()
      
      const handler = playerKillCall![1]

      const killEvent: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        meta: {
          killer: {
            steamId: "76561198000000001",
            playerName: "Killer",
          },
          victim: {
            steamId: "76561198000000002", 
            playerName: "Victim",
          },
        },
        data: {
          weapon: "ak47",
          headshot: true,
          damage: 100,
        },
      }

      await handler(killEvent)

      expect(mockDependencies.playerService.handleKillEvent).toHaveBeenCalled()
      expect(mockDependencies.weaponService.handleWeaponEvent).toHaveBeenCalled()
      expect(mockDependencies.rankingService.handleRatingUpdate).toHaveBeenCalled()
      expect(mockDependencies.matchService.handleKillInMatch).toHaveBeenCalled()
    })

    it("should handle ROUND_START events when emitted through event bus", async () => {
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const roundStartCall = onCalls.find(call => call[0] === EventType.ROUND_START)
      expect(roundStartCall).toBeDefined()
      
      const handler = roundStartCall![1]

      const roundStartEvent: BaseEvent = {
        eventType: EventType.ROUND_START,
        timestamp: new Date(),
        serverId: 1,
        data: {
          roundNumber: 1,
          timelimit: 115,
        },
      }

      await handler(roundStartEvent)

      expect(mockDependencies.matchService.handleMatchEvent).toHaveBeenCalledWith(roundStartEvent)
    })

    it("should handle BOMB_PLANT events when emitted through event bus", async () => {
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const bombPlantCall = onCalls.find(call => call[0] === EventType.BOMB_PLANT)
      expect(bombPlantCall).toBeDefined()
      
      const handler = bombPlantCall![1]

      const bombPlantEvent: BaseEvent = {
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date(),
        serverId: 1,
        data: {
          playerId: 1,
          site: "A",
        },
      }

      await handler(bombPlantEvent)

      expect(mockDependencies.matchService.handleObjectiveEvent).toHaveBeenCalledWith(bombPlantEvent)
    })

    it("should handle WEAPON_FIRE events when emitted through event bus", async () => {
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const weaponFireCall = onCalls.find(call => call[0] === EventType.WEAPON_FIRE)
      expect(weaponFireCall).toBeDefined()
      
      const handler = weaponFireCall![1]

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

      await handler(weaponFireEvent)

      expect(mockDependencies.weaponService.handleWeaponEvent).toHaveBeenCalledWith(weaponFireEvent)
    })

    it("should handle ACTION_PLAYER events when emitted through event bus", async () => {
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const actionPlayerCall = onCalls.find(call => call[0] === EventType.ACTION_PLAYER)
      expect(actionPlayerCall).toBeDefined()
      
      const handler = actionPlayerCall![1]

      const actionEvent: BaseEvent = {
        eventType: EventType.ACTION_PLAYER,
        timestamp: new Date(),
        serverId: 1,
        data: { playerId: 1, actionCode: "test" },
      }

      await handler(actionEvent)

      expect(mockDependencies.actionService.handleActionEvent).toHaveBeenCalledWith(actionEvent)
    })
  })

  describe("Error handling", () => {
    it("should handle player event failures gracefully", async () => {
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const playerConnectCall = onCalls.find(call => call[0] === EventType.PLAYER_CONNECT)
      const handler = playerConnectCall![1]

      const error = new Error("Player service failed")
      mockHandlePlayerEvent.mockRejectedValue(error)

      const playerEvent: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        meta: {
          steamId: "76561198000000000",
          playerName: "TestPlayer",
        },
      }

      await expect(handler(playerEvent)).rejects.toThrow("Player service failed")
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to process player event PLAYER_CONNECT")
      )
    })

    it("should handle kill event failures gracefully", async () => {
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const playerKillCall = onCalls.find(call => call[0] === EventType.PLAYER_KILL)
      const handler = playerKillCall![1]

      const error = new Error("Kill processing failed")
      mockHandleKillEvent.mockRejectedValue(error)

      const killEvent: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        meta: {
          killer: { steamId: "76561198000000001", playerName: "Killer" },
          victim: { steamId: "76561198000000002", playerName: "Victim" },
        },
      }

      await expect(handler(killEvent)).rejects.toThrow("Kill processing failed")
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to process kill event")
      )
    })

    it("should handle events with missing meta gracefully", async () => {
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const playerConnectCall = onCalls.find(call => call[0] === EventType.PLAYER_CONNECT)
      const handler = playerConnectCall![1]

      const eventWithoutMeta: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        data: { ipAddress: "192.168.1.100" },
      }

      await handler(eventWithoutMeta)

      // Should still call handlePlayerEvent even without meta
      expect(mockDependencies.playerService.handlePlayerEvent).toHaveBeenCalled()
      // Should not try to resolve player IDs
      expect(mockDependencies.playerService.getOrCreatePlayer).not.toHaveBeenCalled()
    })
  })

  describe("emitEvents method", () => {
    it("should emit multiple events through the event bus", async () => {
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

      await eventProcessor.emitEvents(events)

      expect(mockEventBus.emit).toHaveBeenCalledTimes(2)
      expect(mockEventBus.emit).toHaveBeenCalledWith(events[0])
      expect(mockEventBus.emit).toHaveBeenCalledWith(events[1])
    })

    it("should handle empty event array", async () => {
      await eventProcessor.emitEvents([])

      expect(mockEventBus.emit).not.toHaveBeenCalled()
    })
  })

  describe("destroy method", () => {
    it("should unregister all event handlers", () => {
      eventProcessor.destroy()

      expect(mockEventBus.off).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        "EventProcessor unregistered all event handlers"
      )
    })
  })

  describe("Player ID resolution", () => {
    it("should resolve single player events correctly", async () => {
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const playerConnectCall = onCalls.find(call => call[0] === EventType.PLAYER_CONNECT)
      const handler = playerConnectCall![1]

      const playerEvent: BaseEvent = {
        eventType: EventType.PLAYER_CONNECT,
        timestamp: new Date(),
        serverId: 1,
        meta: {
          steamId: "76561198000000000",
          playerName: "TestPlayer",
        },
      }

      await handler(playerEvent)

      expect(mockGetServerGame).toHaveBeenCalledWith(1)
      expect(mockGetOrCreatePlayer).toHaveBeenCalledWith(
        "76561198000000000",
        "TestPlayer",
        "cs"
      )
    })

    it("should resolve dual player events (kill events) correctly", async () => {
      const onCalls = (mockEventBus.on as MockedFunction<IEventBus["on"]>).mock.calls
      const playerKillCall = onCalls.find(call => call[0] === EventType.PLAYER_KILL)
      const handler = playerKillCall![1]

      mockGetOrCreatePlayer.mockResolvedValueOnce(10) // killer ID
      mockGetOrCreatePlayer.mockResolvedValueOnce(20) // victim ID

      const killEvent: BaseEvent = {
        eventType: EventType.PLAYER_KILL,
        timestamp: new Date(),
        serverId: 1,
        meta: {
          killer: {
            steamId: "76561198000000001",
            playerName: "Killer",
          },
          victim: {
            steamId: "76561198000000002",
            playerName: "Victim",
          },
        },
        data: {
          weapon: "ak47",
        },
      }

      await handler(killEvent)

      expect(mockGetOrCreatePlayer).toHaveBeenCalledWith(
        "76561198000000001",
        "Killer",
        "cs"
      )
      expect(mockGetOrCreatePlayer).toHaveBeenCalledWith(
        "76561198000000002", 
        "Victim",
        "cs"
      )
    })
  })
})