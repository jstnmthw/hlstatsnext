/**
 * Event Metrics Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { EventMetrics } from "./event-metrics"
import type { ILogger } from "@/shared/utils/logger.types"
import { EventType } from "@/shared/types/events"

describe("EventMetrics", () => {
  let eventMetrics: EventMetrics
  let logger: ILogger

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger

    eventMetrics = new EventMetrics(logger)
  })

  describe("Processing Time Recording", () => {
    it("should record processing time for event types", () => {
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 150)
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 200)
      eventMetrics.recordProcessingTime(EventType.PLAYER_CONNECT, 50)

      const metrics = eventMetrics.getMetrics()

      expect(metrics.totalEvents).toBe(3)
      expect(metrics.eventsByType[EventType.PLAYER_KILL]).toBe(2)
      expect(metrics.eventsByType[EventType.PLAYER_CONNECT]).toBe(1)
      expect(metrics.processingTimes[EventType.PLAYER_KILL]).toEqual({
        count: 2,
        totalTime: 350,
        averageTime: 175,
        minTime: 150,
        maxTime: 200,
      })
    })

    it("should record module-specific processing times", () => {
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 150, "PlayerModule")
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 200, "PlayerModule")
      eventMetrics.recordProcessingTime(EventType.WEAPON_FIRE, 75, "WeaponModule")

      const metrics = eventMetrics.getMetrics()

      expect(metrics.moduleMetrics.PlayerModule).toEqual({
        eventsProcessed: 2,
        averageProcessingTime: 175,
        errorCount: 0,
      })
      expect(metrics.moduleMetrics.WeaponModule).toEqual({
        eventsProcessed: 1,
        averageProcessingTime: 75,
        errorCount: 0,
      })
    })

    it("should log warnings for slow events", () => {
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 1500, "PlayerModule")

      expect(logger.warn).toHaveBeenCalledWith(
        "Slow event processing detected",
        {
          eventType: EventType.PLAYER_KILL,
          duration: "1500ms",
          moduleName: "PlayerModule",
        }
      )
    })

    it("should not log warnings for fast events", () => {
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 500)

      expect(logger.warn).not.toHaveBeenCalled()
    })
  })

  describe("Error Recording", () => {
    it("should record errors for event types", () => {
      const error1 = new Error("Processing failed")
      const error2 = new Error("Database error")

      eventMetrics.recordError(EventType.PLAYER_KILL, error1)
      eventMetrics.recordError(EventType.PLAYER_KILL, error2)
      eventMetrics.recordError(EventType.PLAYER_CONNECT, error1)

      const metrics = eventMetrics.getMetrics()

      expect(metrics.errorCounts[EventType.PLAYER_KILL]).toBe(2)
      expect(metrics.errorCounts[EventType.PLAYER_CONNECT]).toBe(1)
      expect(metrics.errorCounts[EventType.PLAYER_DISCONNECT]).toBe(0)
    })

    it("should record module-specific errors", () => {
      const error = new Error("Module error")

      eventMetrics.recordError(EventType.PLAYER_KILL, error, "PlayerModule")
      eventMetrics.recordError(EventType.PLAYER_KILL, error, "PlayerModule")
      eventMetrics.recordError(EventType.WEAPON_FIRE, error, "WeaponModule")

      const metrics = eventMetrics.getMetrics()

      expect(metrics.moduleMetrics.PlayerModule?.errorCount).toBe(2)
      expect(metrics.moduleMetrics.WeaponModule?.errorCount).toBe(1)
    })

    it("should log errors when recorded", () => {
      const error = new Error("Test error")

      eventMetrics.recordError(EventType.PLAYER_KILL, error, "PlayerModule")

      expect(logger.error).toHaveBeenCalledWith(
        "Event processing error recorded",
        {
          eventType: EventType.PLAYER_KILL,
          error: "Test error",
          moduleName: "PlayerModule",
        }
      )
    })

    it("should create module metrics entry when recording error for new module", () => {
      const error = new Error("New module error")

      eventMetrics.recordError(EventType.PLAYER_KILL, error, "NewModule")

      const metrics = eventMetrics.getMetrics()

      expect(metrics.moduleMetrics.NewModule).toEqual({
        eventsProcessed: 0,
        averageProcessingTime: 0,
        errorCount: 1,
      })
    })
  })

  describe("Comprehensive Metrics", () => {
    beforeEach(() => {
      // Set up some test data
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 150, "PlayerModule")
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 200, "PlayerModule")
      eventMetrics.recordProcessingTime(EventType.PLAYER_CONNECT, 50, "PlayerModule")
      eventMetrics.recordProcessingTime(EventType.WEAPON_FIRE, 75, "WeaponModule")

      const error = new Error("Test error")
      eventMetrics.recordError(EventType.PLAYER_KILL, error, "PlayerModule")
      eventMetrics.recordError(EventType.WEAPON_FIRE, error, "WeaponModule")
    })

    it("should return comprehensive metrics", () => {
      const metrics = eventMetrics.getMetrics()

      expect(metrics.totalEvents).toBe(4)
      expect(metrics.eventsByType[EventType.PLAYER_KILL]).toBe(2)
      expect(metrics.eventsByType[EventType.PLAYER_CONNECT]).toBe(1)
      expect(metrics.eventsByType[EventType.WEAPON_FIRE]).toBe(1)

      expect(metrics.processingTimes[EventType.PLAYER_KILL]).toEqual({
        count: 2,
        totalTime: 350,
        averageTime: 175,
        minTime: 150,
        maxTime: 200,
      })

      expect(metrics.errorCounts[EventType.PLAYER_KILL]).toBe(1)
      expect(metrics.errorCounts[EventType.WEAPON_FIRE]).toBe(1)

      expect(metrics.moduleMetrics.PlayerModule).toEqual({
        eventsProcessed: 3,
        averageProcessingTime: (150 + 200 + 50) / 3,
        errorCount: 1,
      })
    })

    it("should handle event types with no recorded times", () => {
      const metrics = eventMetrics.getMetrics()

      // Should have entries for all event types, even those not recorded
      expect(metrics.errorCounts[EventType.ROUND_START]).toBe(0)
      expect(metrics.eventsByType[EventType.ROUND_START]).toBeUndefined()
      expect(metrics.processingTimes[EventType.ROUND_START]).toBeUndefined()
    })
  })

  describe("Performance Summary", () => {
    beforeEach(() => {
      // Set up test data with varying performance characteristics
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 150)
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 200)
      eventMetrics.recordProcessingTime(EventType.PLAYER_CONNECT, 50)
      eventMetrics.recordProcessingTime(EventType.ROUND_START, 300) // Slowest average

      const error = new Error("Test error")
      eventMetrics.recordError(EventType.PLAYER_KILL, error)
      eventMetrics.recordError(EventType.PLAYER_KILL, error) // Most error-prone
      eventMetrics.recordError(EventType.PLAYER_CONNECT, error)
    })

    it("should calculate performance summary correctly", () => {
      const summary = eventMetrics.getPerformanceSummary()

      expect(summary.totalEvents).toBe(4)
      expect(summary.averageProcessingTime).toBeCloseTo(175) // (150+200+50+300)/4
      expect(summary.errorRate).toBeCloseTo(0.75) // 3 errors / 4 events
      expect(summary.slowestEventType).toEqual({
        eventType: EventType.ROUND_START,
        averageTime: 300,
      })
      expect(summary.mostErrorProneEventType).toEqual({
        eventType: EventType.PLAYER_KILL,
        errorCount: 2,
      })
    })

    it("should handle empty metrics", () => {
      const emptyMetrics = new EventMetrics(logger)
      const summary = emptyMetrics.getPerformanceSummary()

      expect(summary.totalEvents).toBe(0)
      expect(summary.averageProcessingTime).toBe(0)
      expect(summary.errorRate).toBe(0)
      expect(summary.slowestEventType).toBeNull()
      expect(summary.mostErrorProneEventType).toBeNull()
    })

    it("should log performance summary", () => {
      eventMetrics.logPerformanceSummary()

      expect(logger.info).toHaveBeenCalledWith(
        "Event Processing Performance Summary",
        expect.objectContaining({
          totalEvents: 4,
          averageProcessingTime: expect.stringMatching(/\d+\.\d{2}ms/),
          errorRate: expect.stringMatching(/\d+\.\d{2}%/),
          slowestEventType: {
            eventType: EventType.ROUND_START,
            averageTime: "300.00ms",
          },
          mostErrorProneEventType: {
            eventType: EventType.PLAYER_KILL,
            errorCount: 2,
          },
        })
      )
    })

    it("should handle summary with no slow events", () => {
      const cleanMetrics = new EventMetrics(logger)
      cleanMetrics.logPerformanceSummary()

      expect(logger.info).toHaveBeenCalledWith(
        "Event Processing Performance Summary",
        expect.objectContaining({
          slowestEventType: "None",
          mostErrorProneEventType: "None",
        })
      )
    })
  })

  describe("Metrics Reset", () => {
    beforeEach(() => {
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 150)
      eventMetrics.recordError(EventType.PLAYER_KILL, new Error("Test error"))
    })

    it("should reset all metrics", () => {
      let metrics = eventMetrics.getMetrics()
      expect(metrics.totalEvents).toBe(1)

      eventMetrics.reset()

      metrics = eventMetrics.getMetrics()
      expect(metrics.totalEvents).toBe(0)
      expect(metrics.eventsByType[EventType.PLAYER_KILL]).toBeUndefined()
      expect(metrics.errorCounts[EventType.PLAYER_KILL]).toBe(0)
      expect(Object.keys(metrics.moduleMetrics)).toHaveLength(0)

      expect(logger.info).toHaveBeenCalledWith("Event metrics reset")
    })

    it("should allow recording new metrics after reset", () => {
      eventMetrics.reset()
      eventMetrics.recordProcessingTime(EventType.PLAYER_CONNECT, 75)

      const metrics = eventMetrics.getMetrics()
      expect(metrics.totalEvents).toBe(1)
      expect(metrics.eventsByType[EventType.PLAYER_CONNECT]).toBe(1)
    })
  })

  describe("Edge Cases", () => {
    it("should handle zero processing times", () => {
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, 0)

      const metrics = eventMetrics.getMetrics()
      expect(metrics.processingTimes[EventType.PLAYER_KILL]).toEqual({
        count: 1,
        totalTime: 0,
        averageTime: 0,
        minTime: 0,
        maxTime: 0,
      })
    })

    it("should handle negative processing times", () => {
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, -100)

      const metrics = eventMetrics.getMetrics()
      expect(metrics.processingTimes[EventType.PLAYER_KILL].minTime).toBe(-100)
      expect(metrics.processingTimes[EventType.PLAYER_KILL].maxTime).toBe(-100)
    })

    it("should handle very large processing times", () => {
      const largeTime = 999999999
      eventMetrics.recordProcessingTime(EventType.PLAYER_KILL, largeTime)

      expect(logger.warn).toHaveBeenCalledWith(
        "Slow event processing detected",
        expect.objectContaining({
          duration: `${largeTime}ms`,
        })
      )
    })

    it("should handle module metrics with zero events processed", () => {
      const error = new Error("Test error")
      eventMetrics.recordError(EventType.PLAYER_KILL, error, "TestModule")

      const metrics = eventMetrics.getMetrics()
      expect(metrics.moduleMetrics.TestModule!.averageProcessingTime).toBe(0)
    })

    it("should handle errors with undefined or null messages", () => {
      const errorWithUndefinedMessage = { name: "TestError", message: undefined } as unknown as Error
      const errorWithNullMessage = { name: "TestError", message: null } as unknown as Error

      eventMetrics.recordError(EventType.PLAYER_KILL, errorWithUndefinedMessage)
      eventMetrics.recordError(EventType.PLAYER_KILL, errorWithNullMessage)

      const metrics = eventMetrics.getMetrics()
      expect(metrics.errorCounts[EventType.PLAYER_KILL]).toBe(2)
    })
  })
})