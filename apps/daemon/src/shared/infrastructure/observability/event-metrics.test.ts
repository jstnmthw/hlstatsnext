/**
 * Event Metrics Tests
 *
 * Tests for event processing metrics collection.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { EventMetrics } from "./event-metrics"
import { EventType } from "@/shared/types/events"
import { createMockLogger } from "@/tests/mocks/logger"
import type { ILogger } from "@/shared/utils/logger.types"

describe("EventMetrics", () => {
  let metrics: EventMetrics
  let mockLogger: ILogger

  beforeEach(() => {
    mockLogger = createMockLogger()
    metrics = new EventMetrics(mockLogger)
  })

  describe("recordProcessingTime", () => {
    it("should record processing time for event type", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 50)
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 100)

      const result = metrics.getMetrics()

      expect(result.eventsByType[EventType.PLAYER_KILL]).toBe(2)
      expect(result.processingTimes[EventType.PLAYER_KILL].count).toBe(2)
      expect(result.processingTimes[EventType.PLAYER_KILL].totalTime).toBe(150)
      expect(result.processingTimes[EventType.PLAYER_KILL].averageTime).toBe(75)
    })

    it("should track min and max times", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 50)
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 200)
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 100)

      const result = metrics.getMetrics()

      expect(result.processingTimes[EventType.PLAYER_KILL].minTime).toBe(50)
      expect(result.processingTimes[EventType.PLAYER_KILL].maxTime).toBe(200)
    })

    it("should increment total events", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 50)
      metrics.recordProcessingTime(EventType.PLAYER_DISCONNECT, 30)
      metrics.recordProcessingTime(EventType.PLAYER_SUICIDE, 40)

      const result = metrics.getMetrics()

      expect(result.totalEvents).toBe(3)
    })

    it("should track module-specific metrics", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 50, "PlayerModule")
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 100, "PlayerModule")
      metrics.recordProcessingTime(EventType.PLAYER_DISCONNECT, 30, "PlayerModule")

      const result = metrics.getMetrics()

      expect(result.moduleMetrics["PlayerModule"]!.eventsProcessed).toBe(3)
      expect(result.moduleMetrics["PlayerModule"]!.averageProcessingTime).toBe(60) // (50+100+30)/3
    })

    it("should log warning for slow events", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 1500)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Slow event processing detected",
        expect.objectContaining({
          eventType: EventType.PLAYER_KILL,
          duration: "1500ms",
        }),
      )
    })

    it("should not log warning for fast events", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 500)

      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })

  describe("recordError", () => {
    it("should record error count for event type", () => {
      metrics.recordError(EventType.PLAYER_KILL, new Error("Test error"))
      metrics.recordError(EventType.PLAYER_KILL, new Error("Another error"))

      const result = metrics.getMetrics()

      expect(result.errorCounts[EventType.PLAYER_KILL]).toBe(2)
    })

    it("should track module-specific errors", () => {
      metrics.recordError(EventType.PLAYER_KILL, new Error("Test error"), "PlayerModule")
      metrics.recordError(EventType.PLAYER_DISCONNECT, new Error("Error"), "PlayerModule")

      const result = metrics.getMetrics()

      expect(result.moduleMetrics["PlayerModule"]!.errorCount).toBe(2)
    })

    it("should log error with details", () => {
      const error = new Error("Processing failed")
      metrics.recordError(EventType.PLAYER_SUICIDE, error, "TestModule")

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Event processing error recorded",
        expect.objectContaining({
          eventType: EventType.PLAYER_SUICIDE,
          error: "Processing failed",
          moduleName: "TestModule",
        }),
      )
    })
  })

  describe("getMetrics", () => {
    it("should return comprehensive metrics", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 50, "Module1")
      metrics.recordProcessingTime(EventType.PLAYER_DISCONNECT, 30, "Module2")
      metrics.recordError(EventType.PLAYER_KILL, new Error("Error"))

      const result = metrics.getMetrics()

      expect(result.totalEvents).toBe(2)
      expect(result.eventsByType[EventType.PLAYER_KILL]).toBe(1)
      expect(result.eventsByType[EventType.PLAYER_DISCONNECT]).toBe(1)
      expect(result.errorCounts[EventType.PLAYER_KILL]).toBe(1)
      expect(result.moduleMetrics["Module1"]).toBeDefined()
      expect(result.moduleMetrics["Module2"]).toBeDefined()
    })

    it("should return zero for unrecorded event types", () => {
      const result = metrics.getMetrics()

      expect(result.errorCounts[EventType.PLAYER_KILL]).toBe(0)
    })
  })

  describe("getPerformanceSummary", () => {
    it("should return performance summary", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 100)
      metrics.recordProcessingTime(EventType.PLAYER_DISCONNECT, 200)
      metrics.recordError(EventType.PLAYER_KILL, new Error("Error"))

      const summary = metrics.getPerformanceSummary()

      expect(summary.totalEvents).toBe(2)
      expect(summary.averageProcessingTime).toBe(150)
      expect(summary.errorRate).toBe(0.5) // 1 error / 2 events
    })

    it("should identify slowest event type", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 50)
      metrics.recordProcessingTime(EventType.PLAYER_DISCONNECT, 200)
      metrics.recordProcessingTime(EventType.PLAYER_SUICIDE, 100)

      const summary = metrics.getPerformanceSummary()

      expect(summary.slowestEventType?.eventType).toBe(EventType.PLAYER_DISCONNECT)
      expect(summary.slowestEventType?.averageTime).toBe(200)
    })

    it("should identify most error-prone event type", () => {
      metrics.recordError(EventType.PLAYER_KILL, new Error("Error 1"))
      metrics.recordError(EventType.PLAYER_KILL, new Error("Error 2"))
      metrics.recordError(EventType.PLAYER_DISCONNECT, new Error("Error 3"))

      const summary = metrics.getPerformanceSummary()

      expect(summary.mostErrorProneEventType?.eventType).toBe(EventType.PLAYER_KILL)
      expect(summary.mostErrorProneEventType?.errorCount).toBe(2)
    })

    it("should return null for empty metrics", () => {
      const summary = metrics.getPerformanceSummary()

      expect(summary.slowestEventType).toBeNull()
      expect(summary.mostErrorProneEventType).toBeNull()
    })

    it("should calculate zero error rate for no errors", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 100)

      const summary = metrics.getPerformanceSummary()

      expect(summary.errorRate).toBe(0)
    })
  })

  describe("reset", () => {
    it("should clear all metrics", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 50)
      metrics.recordError(EventType.PLAYER_KILL, new Error("Error"))

      metrics.reset()

      const result = metrics.getMetrics()
      expect(result.totalEvents).toBe(0)
      expect(result.eventsByType[EventType.PLAYER_KILL]).toBeUndefined()
    })

    it("should log reset", () => {
      metrics.reset()

      expect(mockLogger.info).toHaveBeenCalledWith("Event metrics reset")
    })
  })

  describe("logPerformanceSummary", () => {
    it("should log formatted performance summary", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 50)
      metrics.recordProcessingTime(EventType.PLAYER_DISCONNECT, 100)

      metrics.logPerformanceSummary()

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Event Processing Performance Summary",
        expect.objectContaining({
          totalEvents: 2,
          averageProcessingTime: "75.00ms",
          errorRate: "0.00%",
        }),
      )
    })

    it("should include slowest event type in summary", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 200)

      metrics.logPerformanceSummary()

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Event Processing Performance Summary",
        expect.objectContaining({
          slowestEventType: expect.objectContaining({
            eventType: EventType.PLAYER_KILL,
          }),
        }),
      )
    })

    it("should show 'None' for no extreme values", () => {
      metrics.logPerformanceSummary()

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Event Processing Performance Summary",
        expect.objectContaining({
          slowestEventType: "None",
          mostErrorProneEventType: "None",
        }),
      )
    })
  })

  describe("multiple event types", () => {
    it("should track metrics separately for each event type", () => {
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 100)
      metrics.recordProcessingTime(EventType.PLAYER_KILL, 200)
      metrics.recordProcessingTime(EventType.PLAYER_DISCONNECT, 50)
      metrics.recordProcessingTime(EventType.PLAYER_SUICIDE, 75)

      const result = metrics.getMetrics()

      expect(result.processingTimes[EventType.PLAYER_KILL].count).toBe(2)
      expect(result.processingTimes[EventType.PLAYER_KILL].averageTime).toBe(150)
      expect(result.processingTimes[EventType.PLAYER_DISCONNECT].count).toBe(1)
      expect(result.processingTimes[EventType.PLAYER_DISCONNECT].averageTime).toBe(50)
      expect(result.processingTimes[EventType.PLAYER_SUICIDE].count).toBe(1)
      expect(result.processingTimes[EventType.PLAYER_SUICIDE].averageTime).toBe(75)
    })
  })
})
