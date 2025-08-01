/**
 * Base Module Event Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { BaseModuleEventHandler } from "./event-handler.base"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import { EventType } from "@/shared/types/events"

// Test implementation for testing base functionality
class TestModuleEventHandler extends BaseModuleEventHandler {
  // No registration needed - events handled via RabbitMQ
}

describe("BaseModuleEventHandler", () => {
  let handler: TestModuleEventHandler
  let logger: ILogger
  let metrics: EventMetrics

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ILogger

    metrics = {
      recordProcessingTime: vi.fn(),
    } as unknown as EventMetrics
  })

  describe("Construction", () => {
    it("should create handler with logger only", () => {
      handler = new TestModuleEventHandler(logger)

      expect(handler).toBeInstanceOf(TestModuleEventHandler)
      expect(handler).toBeInstanceOf(BaseModuleEventHandler)
    })

    it("should create handler with logger and metrics", () => {
      handler = new TestModuleEventHandler(logger, metrics)

      expect(handler).toBeInstanceOf(TestModuleEventHandler)
      expect(handler).toBeInstanceOf(BaseModuleEventHandler)
    })
  })

  describe("Cleanup", () => {
    beforeEach(() => {
      handler = new TestModuleEventHandler(logger, metrics)
    })

    it("should destroy handler successfully", () => {
      handler.destroy()

      expect(logger.debug).toHaveBeenCalledWith(
        "TestModuleEventHandler cleanup completed (queue-only processing)"
      )
    })

    it("should handle destroy even if logger fails", () => {
      const failingLogger = {
        debug: vi.fn().mockImplementation(() => {
          throw new Error("Logger failed")
        }),
      } as unknown as ILogger

      const failingHandler = new TestModuleEventHandler(failingLogger)

      expect(() => failingHandler.destroy()).toThrow("Logger failed")
    })
  })

  describe("Inheritance", () => {
    it("should allow concrete implementations to extend functionality", () => {
      class ExtendedHandler extends BaseModuleEventHandler {
        private initialized = false

        initialize(): void {
          this.initialized = true
          this.logger.info("Extended handler initialized")
        }

        isInitialized(): boolean {
          return this.initialized
        }
      }

      const extendedHandler = new ExtendedHandler(logger)
      expect(extendedHandler.isInitialized()).toBe(false)

      extendedHandler.initialize()
      expect(extendedHandler.isInitialized()).toBe(true)
      expect(logger.info).toHaveBeenCalledWith("Extended handler initialized")
    })

    it("should provide access to protected members in subclasses", () => {
      class AccessTestHandler extends BaseModuleEventHandler {
        testProtectedAccess(): void {
          // Test that protected members are accessible
          this.logger.info("Testing protected access")
          if (this.metrics) {
            this.metrics.recordProcessingTime(EventType.PLAYER_KILL, 100, "TestModule")
          }
          this.logger.debug("Testing protected logger access")
        }
      }

      const accessHandler = new AccessTestHandler(logger, metrics)
      accessHandler.testProtectedAccess()

      expect(logger.info).toHaveBeenCalledWith("Testing protected access")
      expect(logger.debug).toHaveBeenCalledWith("Testing protected logger access")
      expect(metrics.recordProcessingTime).toHaveBeenCalledWith(
        EventType.PLAYER_KILL,
        100,
        "TestModule"
      )
    })
  })

  describe("Optional Metrics", () => {
    it("should work without metrics", () => {
      class MetricsTestHandler extends BaseModuleEventHandler {
        testMetrics(): void {
          if (this.metrics) {
            this.logger.info("Metrics available")
          } else {
            this.logger.info("No metrics available")
          }
        }
      }

      const handlerWithoutMetrics = new MetricsTestHandler(logger)
      handlerWithoutMetrics.testMetrics()

      expect(logger.info).toHaveBeenCalledWith("No metrics available")
    })

    it("should use metrics when available", () => {
      class MetricsTestHandler extends BaseModuleEventHandler {
        testMetrics(): void {
          if (this.metrics) {
            this.metrics.recordProcessingTime(EventType.PLAYER_CONNECT, 50, "TestModule")
            this.logger.info("Metrics available")
          } else {
            this.logger.info("No metrics available")
          }
        }
      }

      const handlerWithMetrics = new MetricsTestHandler(logger, metrics)
      handlerWithMetrics.testMetrics()

      expect(logger.info).toHaveBeenCalledWith("Metrics available")
      expect(metrics.recordProcessingTime).toHaveBeenCalledWith(
        EventType.PLAYER_CONNECT,
        50,
        "TestModule"
      )
    })
  })
})