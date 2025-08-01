/**
 * Base Module Event Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { BaseModuleEventHandler } from "./event-handler.base"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import { EventType } from "@/shared/types/events"

// Test implementation of the abstract base class
class TestModuleEventHandler extends BaseModuleEventHandler {
  registerEventHandlers(): void {
    // Implementation for testing
    this.logger.info("Test module event handlers registered")
  }
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
      recordError: vi.fn(),
      recordEvent: vi.fn(),
      getMetrics: vi.fn(),
      getPerformanceSummary: vi.fn(),
      reset: vi.fn(),
      logPerformanceSummary: vi.fn(),
    } as unknown as EventMetrics
  })

  describe("Constructor", () => {
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

  describe("Abstract Methods", () => {
    beforeEach(() => {
      handler = new TestModuleEventHandler(logger, metrics)
    })

    it("should call registerEventHandlers implementation", () => {
      handler.registerEventHandlers()

      expect(logger.info).toHaveBeenCalledWith("Test module event handlers registered")
    })
  })

  describe("Cleanup", () => {
    beforeEach(() => {
      handler = new TestModuleEventHandler(logger, metrics)
    })

    it("should destroy handler successfully", () => {
      handler.destroy()

      expect(logger.debug).toHaveBeenCalledWith("TestModuleEventHandler cleanup completed (queue-only processing)")
    })

    it("should handle destroy with minimal setup", () => {
      const minimalHandler = new TestModuleEventHandler(logger)
      
      expect(() => minimalHandler.destroy()).not.toThrow()
      expect(logger.debug).toHaveBeenCalledWith("TestModuleEventHandler cleanup completed (queue-only processing)")
    })
  })

  describe("Inheritance", () => {
    it("should allow concrete implementations to extend functionality", () => {
      class ExtendedHandler extends BaseModuleEventHandler {
        private handlersRegistered = false

        registerEventHandlers(): void {
          this.handlersRegistered = true
          this.logger.info("Extended handlers registered")
        }

        isRegistered(): boolean {
          return this.handlersRegistered
        }
      }

      const extendedHandler = new ExtendedHandler(logger)
      expect(extendedHandler.isRegistered()).toBe(false)

      extendedHandler.registerEventHandlers()
      expect(extendedHandler.isRegistered()).toBe(true)
      expect(logger.info).toHaveBeenCalledWith("Extended handlers registered")
    })

    it("should provide access to protected members in subclasses", () => {
      class AccessTestHandler extends BaseModuleEventHandler {
        registerEventHandlers(): void {
          // Test that protected members are accessible
          this.logger.info("Testing protected access")
          if (this.metrics) {
            this.metrics.recordProcessingTime(EventType.PLAYER_KILL, 100, "TestModule")
          }
        }

        testProtectedAccess(): void {
          this.logger.debug("Testing protected logger access")
        }
      }

      const accessHandler = new AccessTestHandler(logger, metrics)
      accessHandler.registerEventHandlers()
      accessHandler.testProtectedAccess()

      expect(logger.info).toHaveBeenCalledWith("Testing protected access")
      expect(logger.debug).toHaveBeenCalledWith("Testing protected logger access")
      expect(metrics.recordProcessingTime).toHaveBeenCalledWith(EventType.PLAYER_KILL, 100, "TestModule")
    })
  })

  describe("Error Handling", () => {
    it("should handle errors in registerEventHandlers gracefully", () => {
      class ErrorHandler extends BaseModuleEventHandler {
        registerEventHandlers(): void {
          throw new Error("Registration failed")
        }
      }

      const errorHandler = new ErrorHandler(logger)
      
      expect(() => errorHandler.registerEventHandlers()).toThrow("Registration failed")
    })

    it("should handle destroy even if logger fails", () => {
      const failingLogger = {
        debug: vi.fn().mockImplementation(() => {
          throw new Error("Logger failed")
        }),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown as ILogger

      const failingHandler = new TestModuleEventHandler(failingLogger)
      
      expect(() => failingHandler.destroy()).toThrow("Logger failed")
    })
  })

  describe("Optional Metrics", () => {
    it("should work without metrics", () => {
      class MetricsTestHandler extends BaseModuleEventHandler {
        registerEventHandlers(): void {
          if (this.metrics) {
            (this.metrics as unknown as { recordEvent: (name: string, value: number) => void }).recordEvent("test", 1)
            this.logger.info("Metrics available")
          } else {
            this.logger.info("No metrics available")
          }
        }
      }

      const handlerWithoutMetrics = new MetricsTestHandler(logger)
      handlerWithoutMetrics.registerEventHandlers()

      expect(logger.info).toHaveBeenCalledWith("No metrics available")
    })

    it("should use metrics when available", () => {
      class MetricsTestHandler extends BaseModuleEventHandler {
        registerEventHandlers(): void {
          if (this.metrics) {
            (this.metrics as unknown as { recordEvent: (name: string, value: number) => void }).recordEvent("test", 1)
            this.logger.info("Metrics available")
          } else {
            this.logger.info("No metrics available")
          }
        }
      }

      const handlerWithMetrics = new MetricsTestHandler(logger, metrics)
      handlerWithMetrics.registerEventHandlers()

      expect(logger.info).toHaveBeenCalledWith("Metrics available")
      expect((metrics as unknown as { recordEvent: ReturnType<typeof vi.fn> }).recordEvent).toHaveBeenCalledWith("test", 1)
    })
  })
})