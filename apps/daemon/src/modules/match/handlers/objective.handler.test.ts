/**
 * ObjectiveHandler Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { ObjectiveHandler } from "./objective.handler"
import { createMockLogger } from "../../../test-support/mocks/logger"
import type { ObjectiveEvent } from "../match.types"
import { EventType } from "@/shared/types/events"

describe("ObjectiveHandler", () => {
  let objectiveHandler: ObjectiveHandler
  let mockMatchService: any
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockLogger = createMockLogger()
    mockMatchService = {
      handleObjectiveEvent: vi.fn(),
      handleMatchEvent: vi.fn(),
      updateServerStats: vi.fn(),
      processRoundEnd: vi.fn(),
      processTeamWin: vi.fn(),
      processMapChange: vi.fn(),
    }

    objectiveHandler = new ObjectiveHandler(mockMatchService, mockLogger)
  })

  describe("Handler instantiation", () => {
    it("should create handler instance", () => {
      expect(objectiveHandler).toBeDefined()
      expect(objectiveHandler).toBeInstanceOf(ObjectiveHandler)
    })

    it("should have required methods", () => {
      expect(objectiveHandler.handleObjectiveEvent).toBeDefined()
      expect(objectiveHandler.getObjectivePoints).toBeDefined()
      expect(typeof objectiveHandler.handleObjectiveEvent).toBe("function")
      expect(typeof objectiveHandler.getObjectivePoints).toBe("function")
    })
  })

  describe("handleObjectiveEvent", () => {
    it("should handle bomb plant events", async () => {
      const bombPlantEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.BOMB_PLANT,
        data: {
          playerId: 1,
          team: "terrorist",
          bombsite: "A",
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockMatchService.handleObjectiveEvent.mockResolvedValue(expectedResult)

      const result = await objectiveHandler.handleObjectiveEvent(bombPlantEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleObjectiveEvent).toHaveBeenCalledWith(bombPlantEvent)
    })

    it("should handle bomb defuse events", async () => {
      const bombDefuseEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.BOMB_DEFUSE,
        data: {
          playerId: 2,
          team: "ct",
          bombsite: "A",
          timeRemaining: 5.2,
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockMatchService.handleObjectiveEvent.mockResolvedValue(expectedResult)

      const result = await objectiveHandler.handleObjectiveEvent(bombDefuseEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleObjectiveEvent).toHaveBeenCalledWith(bombDefuseEvent)
    })

    it("should handle bomb explode events", async () => {
      const bombExplodeEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.BOMB_EXPLODE,
        data: {
          bombsite: "B",
        },
      }

      const expectedResult = { success: true }
      mockMatchService.handleObjectiveEvent.mockResolvedValue(expectedResult)

      const result = await objectiveHandler.handleObjectiveEvent(bombExplodeEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleObjectiveEvent).toHaveBeenCalledWith(bombExplodeEvent)
    })

    it("should handle hostage rescue events", async () => {
      const hostageRescueEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.HOSTAGE_RESCUE,
        data: {
          playerId: 6,
          team: "ct",
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockMatchService.handleObjectiveEvent.mockResolvedValue(expectedResult)

      const result = await objectiveHandler.handleObjectiveEvent(hostageRescueEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleObjectiveEvent).toHaveBeenCalledWith(hostageRescueEvent)
    })

    it("should handle flag capture events", async () => {
      const flagCaptureEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.FLAG_CAPTURE,
        data: {
          playerId: 7,
          flagTeam: "blue",
          captureTeam: "blue",
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockMatchService.handleObjectiveEvent.mockResolvedValue(expectedResult)

      const result = await objectiveHandler.handleObjectiveEvent(flagCaptureEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleObjectiveEvent).toHaveBeenCalledWith(flagCaptureEvent)
    })

    it("should handle service errors and return failure result", async () => {
      const objectiveEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.BOMB_PLANT,
        data: {
          playerId: 1,
          team: "terrorist",
          bombsite: "A",
        },
      }

      const serviceError = new Error("Match service failure")
      mockMatchService.handleObjectiveEvent.mockRejectedValue(serviceError)

      const result = await objectiveHandler.handleObjectiveEvent(objectiveEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Match service failure")
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Objective event handler failed: Error: Match service failure",
      )
    })

    it("should handle non-Error exceptions", async () => {
      const objectiveEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.BOMB_DEFUSE,
        data: {
          playerId: 2,
          team: "ct",
          bombsite: "B",
        },
      }

      mockMatchService.handleObjectiveEvent.mockRejectedValue("String error")

      const result = await objectiveHandler.handleObjectiveEvent(objectiveEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("String error")
      expect(mockLogger.error).toHaveBeenCalledWith("Objective event handler failed: String error")
    })

    it("should preserve service result structure", async () => {
      const objectiveEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.CONTROL_POINT_CAPTURE,
        data: {
          playerId: 8,
          pointName: "Point C",
          capturingTeam: "red",
          captureTime: 45.5,
        },
      }

      const serviceResult = {
        success: true,
        affected: 1,
      }
      mockMatchService.handleObjectiveEvent.mockResolvedValue(serviceResult)

      const result = await objectiveHandler.handleObjectiveEvent(objectiveEvent)

      expect(result).toEqual(serviceResult)
      expect(result.affected).toBe(1)
    })
  })

  describe("getObjectivePoints", () => {
    it("should return correct points for bomb events", () => {
      expect(objectiveHandler.getObjectivePoints("BOMB_PLANT")).toBe(3)
      expect(objectiveHandler.getObjectivePoints("BOMB_DEFUSE")).toBe(3)
      expect(objectiveHandler.getObjectivePoints("BOMB_EXPLODE")).toBe(0)
    })

    it("should return correct points for hostage events", () => {
      expect(objectiveHandler.getObjectivePoints("HOSTAGE_RESCUE")).toBe(2)
      expect(objectiveHandler.getObjectivePoints("HOSTAGE_TOUCH")).toBe(1)
    })

    it("should return correct points for flag events", () => {
      expect(objectiveHandler.getObjectivePoints("FLAG_CAPTURE")).toBe(5)
      expect(objectiveHandler.getObjectivePoints("FLAG_DEFEND")).toBe(3)
      expect(objectiveHandler.getObjectivePoints("FLAG_PICKUP")).toBe(1)
      expect(objectiveHandler.getObjectivePoints("FLAG_DROP")).toBe(0)
    })

    it("should return correct points for control point events", () => {
      expect(objectiveHandler.getObjectivePoints("CONTROL_POINT_CAPTURE")).toBe(4)
      expect(objectiveHandler.getObjectivePoints("CONTROL_POINT_DEFEND")).toBe(2)
    })

    it("should return default points for unknown event types", () => {
      expect(objectiveHandler.getObjectivePoints("UNKNOWN_EVENT")).toBe(1)
      expect(objectiveHandler.getObjectivePoints("CUSTOM_OBJECTIVE")).toBe(1)
      expect(objectiveHandler.getObjectivePoints("")).toBe(1)
    })

    it("should handle case sensitivity", () => {
      expect(objectiveHandler.getObjectivePoints("bomb_plant")).toBe(1) // Should return default for lowercase
      expect(objectiveHandler.getObjectivePoints("Bomb_Plant")).toBe(1) // Should return default for mixed case
    })
  })

  describe("Error scenarios", () => {
    it("should handle timeout errors", async () => {
      const objectiveEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.BOMB_PLANT,
        data: {
          playerId: 1,
          team: "terrorist",
          bombsite: "A",
        },
      }

      const timeoutError = new Error("Request timeout")
      timeoutError.name = "TimeoutError"
      mockMatchService.handleObjectiveEvent.mockRejectedValue(timeoutError)

      const result = await objectiveHandler.handleObjectiveEvent(objectiveEvent)

      expect(result.success).toBe(false)
      expect(result.error).toBe("Request timeout")
    })

    it("should handle validation errors from service", async () => {
      const invalidEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.BOMB_PLANT,
        data: {
          playerId: -1, // Invalid player ID
          team: "terrorist",
          bombsite: "A",
        },
      }

      const serviceResult = {
        success: false,
        error: "Invalid player ID",
      }
      mockMatchService.handleObjectiveEvent.mockResolvedValue(serviceResult)

      const result = await objectiveHandler.handleObjectiveEvent(invalidEvent)

      expect(result).toEqual(serviceResult)
      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid player ID")
    })
  })

  describe("Edge cases", () => {
    it("should handle events with minimal data", async () => {
      const minimalEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.BOMB_EXPLODE,
        data: {
          bombsite: "A",
        },
      }

      const expectedResult = { success: true }
      mockMatchService.handleObjectiveEvent.mockResolvedValue(expectedResult)

      const result = await objectiveHandler.handleObjectiveEvent(minimalEvent)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleObjectiveEvent).toHaveBeenCalledWith(minimalEvent)
    })

    it("should handle events with additional metadata", async () => {
      const eventWithMeta: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.FLAG_CAPTURE,
        data: {
          playerId: 12,
          flagTeam: "blue",
          captureTeam: "blue",
        },
        meta: {
          steamId: "76561198000000012",
          playerName: "MetaPlayer",
          isBot: false,
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockMatchService.handleObjectiveEvent.mockResolvedValue(expectedResult)

      const result = await objectiveHandler.handleObjectiveEvent(eventWithMeta)

      expect(result).toEqual(expectedResult)
      expect(mockMatchService.handleObjectiveEvent).toHaveBeenCalledWith(eventWithMeta)
    })

    it("should handle very large objective event data", async () => {
      const largeEvent: ObjectiveEvent = {
        timestamp: new Date(),
        serverId: 1,
        eventType: EventType.CONTROL_POINT_CAPTURE,
        data: {
          playerId: 999999,
          pointName: "Point A",
          capturingTeam: "red",
          captureTime: 999.99,
        },
      }

      const expectedResult = { success: true, affected: 1 }
      mockMatchService.handleObjectiveEvent.mockResolvedValue(expectedResult)

      const result = await objectiveHandler.handleObjectiveEvent(largeEvent)

      expect(result).toEqual(expectedResult)
    })
  })
})
