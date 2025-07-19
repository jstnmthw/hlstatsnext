/**
 * Advanced Events Service Tests
 *
 * Tests for the EventService handling of new advanced event types
 * (objective events and server stats events).
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { EventService } from "../../../src/services/event/event.service"
import { createMockLogger, createMockDatabaseClient } from "../../types/test-mocks"
import type { DatabaseClient } from "../../../src/database/client"
import type { 
  BombPlantEvent,
  BombDefuseEvent,
  BombExplodeEvent,
  HostageRescueEvent,
  HostageTouchEvent,
  FlagCaptureEvent,
  FlagDefendEvent,
  FlagPickupEvent,
  FlagDropEvent,
  ControlPointCaptureEvent,
  ControlPointDefendEvent,
  ServerStatsUpdateEvent
} from "../../../src/types/common/events"
import { EventType } from "../../../src/types/common/events"

describe("EventService - Advanced Events", () => {
  let eventService: EventService
  let mockDatabase: DatabaseClient
  const loggerMock = createMockLogger()

  beforeEach(() => {
    vi.clearAllMocks()
    mockDatabase = createMockDatabaseClient()
    eventService = new EventService(mockDatabase, loggerMock)
  })

  describe("Bomb Events", () => {
    it("should create bomb plant event record", async () => {
      const bombPlantEvent: BombPlantEvent = {
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 123,
          bombsite: "A",
          position: { x: 100, y: 200, z: 50 },
          team: "TERRORIST"
        },
        meta: {
          steamId: "STEAM_1:0:123456",
          playerName: "TestPlayer",
          isBot: false
        }
      }

      await eventService.createGameEvent(bombPlantEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: bombPlantEvent.timestamp,
          playerId: 123,
          serverId: 1,
          map: "",
          actionId: 1, // Bomb plant action ID
          bonus: 3,
          pos_x: 100,
          pos_y: 200,
          pos_z: 50
        }
      })
    })

    it("should create bomb defuse event record", async () => {
      const bombDefuseEvent: BombDefuseEvent = {
        eventType: EventType.BOMB_DEFUSE,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 456,
          bombsite: "B",
          position: { x: 300, y: 400, z: 75 },
          team: "CT",
          timeRemaining: 10
        }
      }

      await eventService.createGameEvent(bombDefuseEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: bombDefuseEvent.timestamp,
          playerId: 456,
          serverId: 1,
          map: "",
          actionId: 2, // Bomb defuse action ID
          bonus: 3,
          pos_x: 300,
          pos_y: 400,
          pos_z: 75
        }
      })
    })

    it("should create bomb explode event record", async () => {
      const bombExplodeEvent: BombExplodeEvent = {
        eventType: EventType.BOMB_EXPLODE,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          bombsite: "A",
          position: { x: 100, y: 200, z: 50 },
          planterPlayerId: 123
        }
      }

      await eventService.createGameEvent(bombExplodeEvent)

      expect(mockDatabase.spies.eventWorldActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: bombExplodeEvent.timestamp,
          serverId: 1,
          map: "",
          actionId: 3, // Bomb explode action ID
          bonus: 0
        }
      })
    })
  })

  describe("Hostage Events", () => {
    it("should create hostage rescue event record", async () => {
      const hostageRescueEvent: HostageRescueEvent = {
        eventType: EventType.HOSTAGE_RESCUE,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 789,
          hostageId: 1,
          position: { x: 500, y: 600, z: 100 },
          team: "CT"
        }
      }

      await eventService.createGameEvent(hostageRescueEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: hostageRescueEvent.timestamp,
          playerId: 789,
          serverId: 1,
          map: "",
          actionId: 4, // Hostage rescue action ID
          bonus: 2,
          pos_x: 500,
          pos_y: 600,
          pos_z: 100
        }
      })
    })

    it("should create hostage touch event record", async () => {
      const hostageTouchEvent: HostageTouchEvent = {
        eventType: EventType.HOSTAGE_TOUCH,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 789,
          hostageId: 2,
          position: { x: 500, y: 600, z: 100 },
          team: "CT"
        }
      }

      await eventService.createGameEvent(hostageTouchEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: hostageTouchEvent.timestamp,
          playerId: 789,
          serverId: 1,
          map: "",
          actionId: 5, // Hostage touch action ID
          bonus: 1,
          pos_x: 500,
          pos_y: 600,
          pos_z: 100
        }
      })
    })
  })

  describe("Flag Events", () => {
    it("should create flag capture event record", async () => {
      const flagCaptureEvent: FlagCaptureEvent = {
        eventType: EventType.FLAG_CAPTURE,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 111,
          flagTeam: "BLUE",
          captureTeam: "RED",
          position: { x: 700, y: 800, z: 150 }
        }
      }

      await eventService.createGameEvent(flagCaptureEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: flagCaptureEvent.timestamp,
          playerId: 111,
          serverId: 1,
          map: "",
          actionId: 10, // Flag capture action ID
          bonus: 5,
          pos_x: 700,
          pos_y: 800,
          pos_z: 150
        }
      })
    })

    it("should create flag defend event record", async () => {
      const flagDefendEvent: FlagDefendEvent = {
        eventType: EventType.FLAG_DEFEND,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 222,
          flagTeam: "RED",
          position: { x: 200, y: 300, z: 80 },
          team: "RED"
        }
      }

      await eventService.createGameEvent(flagDefendEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: flagDefendEvent.timestamp,
          playerId: 222,
          serverId: 1,
          map: "",
          actionId: 11, // Flag defend action ID
          bonus: 3,
          pos_x: 200,
          pos_y: 300,
          pos_z: 80
        }
      })
    })

    it("should create flag pickup event record", async () => {
      const flagPickupEvent: FlagPickupEvent = {
        eventType: EventType.FLAG_PICKUP,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 333,
          flagTeam: "BLUE",
          position: { x: 400, y: 500, z: 120 },
          team: "RED"
        }
      }

      await eventService.createGameEvent(flagPickupEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: flagPickupEvent.timestamp,
          playerId: 333,
          serverId: 1,
          map: "",
          actionId: 12, // Flag pickup action ID
          bonus: 1,
          pos_x: 400,
          pos_y: 500,
          pos_z: 120
        }
      })
    })

    it("should create flag drop event record", async () => {
      const flagDropEvent: FlagDropEvent = {
        eventType: EventType.FLAG_DROP,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 444,
          flagTeam: "BLUE",
          position: { x: 600, y: 700, z: 90 },
          team: "RED",
          reason: "killed"
        }
      }

      await eventService.createGameEvent(flagDropEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: flagDropEvent.timestamp,
          playerId: 444,
          serverId: 1,
          map: "",
          actionId: 13, // Flag drop action ID
          bonus: 0,
          pos_x: 600,
          pos_y: 700,
          pos_z: 90
        }
      })
    })
  })

  describe("Control Point Events", () => {
    it("should create control point capture event record", async () => {
      const cpCaptureEvent: ControlPointCaptureEvent = {
        eventType: EventType.CONTROL_POINT_CAPTURE,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 555,
          pointName: "Point A",
          pointId: 1,
          capturingTeam: "BLUE",
          previousOwner: "RED",
          position: { x: 900, y: 1000, z: 200 },
          captureTime: 45
        }
      }

      await eventService.createGameEvent(cpCaptureEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: cpCaptureEvent.timestamp,
          playerId: 555,
          serverId: 1,
          map: "",
          actionId: 14, // Control point capture action ID
          bonus: 4,
          pos_x: 900,
          pos_y: 1000,
          pos_z: 200
        }
      })
    })

    it("should create control point defend event record", async () => {
      const cpDefendEvent: ControlPointDefendEvent = {
        eventType: EventType.CONTROL_POINT_DEFEND,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 666,
          pointName: "Point B",
          pointId: 2,
          defendingTeam: "RED",
          position: { x: 1100, y: 1200, z: 250 },
          team: "RED"
        }
      }

      await eventService.createGameEvent(cpDefendEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: cpDefendEvent.timestamp,
          playerId: 666,
          serverId: 1,
          map: "",
          actionId: 15, // Control point defend action ID
          bonus: 2,
          pos_x: 1100,
          pos_y: 1200,
          pos_z: 250
        }
      })
    })
  })

  describe("Server Stats Update Events", () => {
    it("should update server statistics with provided data", async () => {
      const serverStatsEvent: ServerStatsUpdateEvent = {
        eventType: EventType.SERVER_STATS_UPDATE,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          kills: 5,
          headshots: 2,
          bombsPlanted: 1,
          bombsDefused: 1,
          ctWins: 1,
          actPlayers: 12,
          maxPlayers: 24
        }
      }

      await eventService.createGameEvent(serverStatsEvent)

      expect(mockDatabase.spies.serverUpdate).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: {
          kills: { increment: 5 },
          headshots: { increment: 2 },
          bombs_planted: { increment: 1 },
          bombs_defused: { increment: 1 },
          ct_wins: { increment: 1 },
          act_players: 12,
          max_players: 24
        }
      })
    })

    it("should handle partial server stats updates", async () => {
      const serverStatsEvent: ServerStatsUpdateEvent = {
        eventType: EventType.SERVER_STATS_UPDATE,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          kills: 1,
          actMap: "de_mirage"
        }
      }

      await eventService.createGameEvent(serverStatsEvent)

      expect(mockDatabase.spies.serverUpdate).toHaveBeenCalledWith({
        where: { serverId: 1 },
        data: {
          kills: { increment: 1 },
          act_map: "de_mirage"
        }
      })
    })

    it("should not update server if no data provided", async () => {
      const serverStatsEvent: ServerStatsUpdateEvent = {
        eventType: EventType.SERVER_STATS_UPDATE,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {}
      }

      await eventService.createGameEvent(serverStatsEvent)

      expect(mockDatabase.spies.serverUpdate).not.toHaveBeenCalled()
    })
  })

  describe("Event Handling", () => {
    it("should handle events without position data", async () => {
      const bombPlantEvent: BombPlantEvent = {
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 123,
          bombsite: "A",
          team: "TERRORIST"
          // No position data
        }
      }

      await eventService.createGameEvent(bombPlantEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: bombPlantEvent.timestamp,
          playerId: 123,
          serverId: 1,
          map: "",
          actionId: 1,
          bonus: 3,
          pos_x: null,
          pos_y: null,
          pos_z: null
        }
      })
    })

    it("should handle unknown objective event types with default values", async () => {
      const unknownEvent = {
        eventType: "UNKNOWN_OBJECTIVE" as unknown as EventType,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 999,
          position: { x: 0, y: 0, z: 0 }
        }
      }

      await eventService.createGameEvent(unknownEvent)

      expect(mockDatabase.spies.eventPlayerActionCreate).toHaveBeenCalledWith({
        data: {
          eventTime: unknownEvent.timestamp,
          playerId: 999,
          serverId: 1,
          map: "",
          actionId: 99, // Default action ID for unknown events
          bonus: 0, // Default bonus for unknown events
          pos_x: 0,
          pos_y: 0,
          pos_z: 0
        }
      })
    })
  })

  describe("Error Handling", () => {
    it("should handle database errors for objective events", async () => {
      const bombPlantEvent: BombPlantEvent = {
        eventType: EventType.BOMB_PLANT,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          playerId: 123,
          bombsite: "A",
          team: "TERRORIST"
        }
      }

      mockDatabase.spies.eventPlayerActionCreate.mockRejectedValueOnce(new Error("Database error"))

      await expect(eventService.createGameEvent(bombPlantEvent)).rejects.toThrow("Database error")
      expect(loggerMock.error).toHaveBeenCalledWith(
        "Failed to create game event: Database error"
      )
    })

    it("should handle database errors for server stats events", async () => {
      const serverStatsEvent: ServerStatsUpdateEvent = {
        eventType: EventType.SERVER_STATS_UPDATE,
        timestamp: new Date("2024-01-01T12:00:00Z"),
        serverId: 1,
        data: {
          kills: 1
        }
      }

      mockDatabase.spies.serverUpdate.mockRejectedValueOnce(new Error("Database error"))

      await expect(eventService.createGameEvent(serverStatsEvent)).rejects.toThrow("Database error")
      expect(loggerMock.error).toHaveBeenCalledWith(
        "Failed to create game event: Database error"
      )
    })
  })
})