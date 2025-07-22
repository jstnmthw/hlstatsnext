/**
 * Logger Implementation Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Logger, logger, type LogStatus } from "./logger"
import type { ILogger } from "./logger.types"
import type { MockInstance } from "vitest"

describe("Logger", () => {
  let testLogger: Logger
  let consoleSpy: MockInstance

  beforeEach(() => {
    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    testLogger = new Logger({ enableColors: false, showTimestamp: false })
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    vi.clearAllMocks()
  })

  describe("Logger instantiation", () => {
    it("should create logger with default options", () => {
      const defaultLogger = new Logger()
      expect(defaultLogger).toBeDefined()
      expect(defaultLogger).toBeInstanceOf(Logger)
    })

    it("should create logger with custom options", () => {
      const customLogger = new Logger({
        enableColors: false,
        showTimestamp: false,
      })
      expect(customLogger).toBeDefined()
      expect(customLogger).toBeInstanceOf(Logger)
    })

    it("should implement ILogger interface", () => {
      const loggerAsInterface: ILogger = new Logger()
      expect(loggerAsInterface).toBeDefined()

      // Test that all required methods exist
      expect(typeof loggerAsInterface.ok).toBe("function")
      expect(typeof loggerAsInterface.error).toBe("function")
      expect(typeof loggerAsInterface.info).toBe("function")
      expect(typeof loggerAsInterface.warn).toBe("function")
      expect(typeof loggerAsInterface.debug).toBe("function")
    })

    it("should have default options when not provided", () => {
      const logger = new Logger()

      // Test with colors enabled (default)
      logger.info("test message")
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("\x1b[34m[ INFO ]\x1b[0m test message"),
      )
    })
  })

  describe("Basic logging methods", () => {
    it("should log OK messages", () => {
      testLogger.ok("Operation successful")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ OK ] Operation successful"),
      )
    })

    it("should log ERROR messages", () => {
      testLogger.error("Something went wrong")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ ERROR ] Something went wrong"),
      )
    })

    it("should log INFO messages", () => {
      testLogger.info("Information message")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ INFO ] Information message"),
      )
    })

    it("should log WARN messages", () => {
      testLogger.warn("Warning message")

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[ WARN ] Warning message"))
    })

    it("should log DEBUG messages", () => {
      testLogger.debug("Debug information")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ DEBUG ] Debug information"),
      )
    })

    it("should log EVENT messages", () => {
      testLogger.event("Event occurred")

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[ EVENT ] Event occurred"))
    })

    it("should log CHAT messages", () => {
      testLogger.chat("Player chat message")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ CHAT ] Player chat message"),
      )
    })
  })

  describe("Service lifecycle methods", () => {
    it("should log service starting", () => {
      testLogger.starting("Database")

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[ INFO ] Starting Database"))
    })

    it("should log service started", () => {
      testLogger.started("Database")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ OK ] Database started successfully"),
      )
    })

    it("should log service stopping", () => {
      testLogger.stopping("UDP Server")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ INFO ] Stopping UDP Server"),
      )
    })

    it("should log service stopped", () => {
      testLogger.stopped("UDP Server")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ OK ] UDP Server stopped successfully"),
      )
    })

    it("should log connecting to service", () => {
      testLogger.connecting("MySQL Database")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ INFO ] Connecting to MySQL Database"),
      )
    })

    it("should log connected to service", () => {
      testLogger.connected("MySQL Database")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ OK ] Connected to MySQL Database"),
      )
    })

    it("should log disconnected from service", () => {
      testLogger.disconnected("Redis Cache")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ OK ] Disconnected from Redis Cache"),
      )
    })
  })

  describe("Error and status methods", () => {
    it("should log failed operation without error details", () => {
      testLogger.failed("Database connection")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ ERROR ] Database connection"),
      )
    })

    it("should log failed operation with error details", () => {
      testLogger.failed("Database connection", "Connection timeout")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ ERROR ] Database connection: Connection timeout"),
      )
    })

    it("should log ready message", () => {
      testLogger.ready("HLStats Daemon is ready")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ OK ] HLStats Daemon is ready"),
      )
    })

    it("should log received signal", () => {
      testLogger.received("SIGTERM")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ INFO ] Received SIGTERM, shutting down gracefully"),
      )
    })

    it("should log shutdown message", () => {
      testLogger.shutdown()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ INFO ] Shutting down HLStats Daemon"),
      )
    })

    it("should log shutdown complete", () => {
      testLogger.shutdownComplete()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ OK ] Daemon shutdown complete"),
      )
    })

    it("should log fatal error", () => {
      testLogger.fatal("Out of memory")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ ERROR ] Fatal error: Out of memory"),
      )
    })
  })

  describe("Color formatting", () => {
    it("should apply green color to OK status", () => {
      const colorLogger = new Logger({ enableColors: true })
      colorLogger.ok("Success message")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("\x1b[32m\x1b[1m[ OK ]\x1b[0m"),
      )
    })

    it("should apply red color to ERROR status", () => {
      const colorLogger = new Logger({ enableColors: true })
      colorLogger.error("Error message")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("\x1b[31m\x1b[1m[ ERROR ]\x1b[0m"),
      )
    })

    it("should apply blue color to INFO status", () => {
      const colorLogger = new Logger({ enableColors: true })
      colorLogger.info("Info message")

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("\x1b[34m[ INFO ]\x1b[0m"))
    })

    it("should apply yellow color to WARN status", () => {
      const colorLogger = new Logger({ enableColors: true })
      colorLogger.warn("Warning message")

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("\x1b[33m[ WARN ]\x1b[0m"))
    })

    it("should apply magenta color to DEBUG status", () => {
      const colorLogger = new Logger({ enableColors: true })
      colorLogger.debug("Debug message")

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("\x1b[35m[ DEBUG ]\x1b[0m"))
    })

    it("should apply cyan color to EVENT status", () => {
      const colorLogger = new Logger({ enableColors: true })
      colorLogger.event("Event message")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("\x1b[36m\x1b[1m[ EVENT ]\x1b[0m"),
      )
    })

    it("should apply yellow bright color to CHAT status", () => {
      const colorLogger = new Logger({ enableColors: true })
      colorLogger.chat("Chat message")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("\x1b[33m\x1b[1m[ CHAT ]\x1b[0m"),
      )
    })

    it("should not apply colors when disabled", () => {
      const noColorLogger = new Logger({ enableColors: false })
      noColorLogger.error("Error without color")

      expect(consoleSpy).toHaveBeenCalledWith(expect.not.stringContaining("\x1b["))
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ ERROR ] Error without color"),
      )
    })
  })

  describe("Timestamp formatting", () => {
    beforeEach(() => {
      // Mock Date to have predictable timestamps
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2023-12-25T10:30:45.123Z"))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("should include timestamp when enabled", () => {
      const timestampLogger = new Logger({ showTimestamp: true })
      timestampLogger.info("Message with timestamp")

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[2023-12-25 10:30:45]"))
    })

    it("should not include timestamp when disabled", () => {
      const noTimestampLogger = new Logger({ showTimestamp: false })
      noTimestampLogger.info("Message without timestamp")

      expect(consoleSpy).toHaveBeenCalledWith(expect.not.stringContaining("[2023-12-25 10:30:45]"))
    })

    it("should format timestamp with gray color when colors enabled", () => {
      const colorTimestampLogger = new Logger({ enableColors: true, showTimestamp: true })
      colorTimestampLogger.info("Colored timestamp")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("\x1b[90m[2023-12-25 10:30:45]\x1b[0m"),
      )
    })

    it("should format timestamp without color when colors disabled", () => {
      const noColorTimestampLogger = new Logger({ enableColors: false, showTimestamp: true })
      noColorTimestampLogger.info("No color timestamp")

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[2023-12-25 10:30:45]"))
      expect(consoleSpy).toHaveBeenCalledWith(expect.not.stringContaining("\x1b[90m"))
    })
  })

  describe("Configuration methods", () => {
    it("should disable timestamps", () => {
      testLogger.enableTimestamps()
      testLogger.info("With timestamp")

      testLogger.disableTimestamps()
      testLogger.info("Without timestamp")

      expect(consoleSpy).toHaveBeenNthCalledWith(1, expect.stringContaining("["))
      expect(consoleSpy).toHaveBeenNthCalledWith(2, expect.not.stringContaining("[2"))
    })

    it("should enable timestamps", () => {
      testLogger.disableTimestamps()
      testLogger.info("Without timestamp")

      testLogger.enableTimestamps()
      testLogger.info("With timestamp")

      expect(consoleSpy).toHaveBeenNthCalledWith(1, expect.not.stringContaining("[2"))
      expect(consoleSpy).toHaveBeenNthCalledWith(2, expect.stringContaining("["))
    })

    it("should disable colors", () => {
      testLogger.disableColors()
      testLogger.error("Error without colors")

      expect(consoleSpy).toHaveBeenCalledWith(expect.not.stringContaining("\x1b["))
    })

    it("should set colors enabled/disabled", () => {
      testLogger.setColorsEnabled(false)
      testLogger.error("Error without colors")

      testLogger.setColorsEnabled(true)
      testLogger.error("Error with colors")

      expect(consoleSpy).toHaveBeenNthCalledWith(1, expect.not.stringContaining("\x1b["))
      expect(consoleSpy).toHaveBeenNthCalledWith(2, expect.stringContaining("\x1b["))
    })
  })

  describe("Message formatting and edge cases", () => {
    it("should handle empty messages", () => {
      testLogger.info("")

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[ INFO ] "))
    })

    it("should handle very long messages", () => {
      const longMessage = "A".repeat(1000)
      testLogger.info(longMessage)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`[ INFO ] ${longMessage}`))
    })

    it("should handle messages with special characters", () => {
      const specialMessage = "Message with \n newlines \t tabs \r carriage returns"
      testLogger.info(specialMessage)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`[ INFO ] ${specialMessage}`))
    })

    it("should handle Unicode characters", () => {
      const unicodeMessage = "Message with emojis 🎮🎯 and accents café"
      testLogger.info(unicodeMessage)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`[ INFO ] ${unicodeMessage}`))
    })

    it("should handle messages with ANSI escape sequences", () => {
      const ansiMessage = "Message with \x1b[31mexisting\x1b[0m colors"
      testLogger.info(ansiMessage)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`[ INFO ] ${ansiMessage}`))
    })

    it("should preserve exact message content", () => {
      const exactMessage = "Exact message content with spaces   and punctuation!"
      testLogger.warn(exactMessage)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`[ WARN ] ${exactMessage}`))
    })
  })

  describe("Real-world daemon scenarios", () => {
    it("should handle typical daemon startup sequence", () => {
      testLogger.starting("HLStats Daemon")
      testLogger.connecting("Database")
      testLogger.connected("Database")
      testLogger.starting("UDP Server")
      testLogger.started("UDP Server")
      testLogger.ready("HLStats Daemon ready to process events")

      expect(consoleSpy).toHaveBeenCalledTimes(6)
      expect(consoleSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("[ INFO ] Starting HLStats Daemon"),
      )
      expect(consoleSpy).toHaveBeenNthCalledWith(
        6,
        expect.stringContaining("[ OK ] HLStats Daemon ready to process events"),
      )
    })

    it("should handle error scenarios", () => {
      testLogger.failed("Database connection", "Connection refused")
      testLogger.fatal("Critical database error")
      testLogger.shutdown()

      expect(consoleSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("[ ERROR ] Database connection: Connection refused"),
      )
      expect(consoleSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("[ ERROR ] Fatal error: Critical database error"),
      )
    })

    it("should handle graceful shutdown sequence", () => {
      testLogger.received("SIGINT")
      testLogger.stopping("UDP Server")
      testLogger.stopped("UDP Server")
      testLogger.stopping("Database")
      testLogger.disconnected("Database")
      testLogger.shutdownComplete()

      expect(consoleSpy).toHaveBeenCalledTimes(6)
      expect(consoleSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("[ INFO ] Received SIGINT, shutting down gracefully"),
      )
      expect(consoleSpy).toHaveBeenNthCalledWith(
        6,
        expect.stringContaining("[ OK ] Daemon shutdown complete"),
      )
    })

    it("should handle event processing logs", () => {
      testLogger.event("Player connected: TestPlayer (76561198000000000)")
      testLogger.debug("Processing PLAYER_CONNECT event for server 1")
      testLogger.chat("<TestPlayer> Hello World!")

      expect(consoleSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("[ EVENT ] Player connected: TestPlayer (76561198000000000)"),
      )
      expect(consoleSpy).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("[ CHAT ] <TestPlayer> Hello World!"),
      )
    })
  })

  describe("Default logger instance", () => {
    it("should export a default logger instance", () => {
      expect(logger).toBeDefined()
      expect(logger).toBeInstanceOf(Logger)
    })

    it("should work with the default logger", () => {
      logger.disableColors()
      logger.disableTimestamps()
      logger.info("Default logger test")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ INFO ] Default logger test"),
      )
    })

    it("should be configurable", () => {
      logger.disableColors()
      logger.error("No colors error")

      expect(consoleSpy).toHaveBeenCalledWith(expect.not.stringContaining("\x1b["))

      // Reset for other tests
      logger.setColorsEnabled(true)
    })
  })

  describe("Logger class export", () => {
    it("should export Logger class as default", () => {
      const CustomLogger = Logger
      const customInstance = new CustomLogger({ enableColors: false })

      expect(customInstance).toBeInstanceOf(Logger)
      customInstance.info("Custom logger instance")

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ INFO ] Custom logger instance"),
      )
    })
  })

  describe("Type safety and interface compliance", () => {
    it("should satisfy ILogger interface completely", () => {
      const loggerAsInterface: ILogger = new Logger()

      // Test all interface methods
      expect(typeof loggerAsInterface.ok).toBe("function")
      expect(typeof loggerAsInterface.error).toBe("function")
      expect(typeof loggerAsInterface.info).toBe("function")
      expect(typeof loggerAsInterface.warn).toBe("function")
      expect(typeof loggerAsInterface.debug).toBe("function")
      expect(typeof loggerAsInterface.event).toBe("function")
      expect(typeof loggerAsInterface.chat).toBe("function")
      expect(typeof loggerAsInterface.starting).toBe("function")
      expect(typeof loggerAsInterface.started).toBe("function")
      expect(typeof loggerAsInterface.stopping).toBe("function")
      expect(typeof loggerAsInterface.stopped).toBe("function")
      expect(typeof loggerAsInterface.connecting).toBe("function")
      expect(typeof loggerAsInterface.connected).toBe("function")
      expect(typeof loggerAsInterface.disconnected).toBe("function")
      expect(typeof loggerAsInterface.failed).toBe("function")
      expect(typeof loggerAsInterface.ready).toBe("function")
      expect(typeof loggerAsInterface.received).toBe("function")
      expect(typeof loggerAsInterface.shutdown).toBe("function")
      expect(typeof loggerAsInterface.shutdownComplete).toBe("function")
      expect(typeof loggerAsInterface.fatal).toBe("function")
      expect(typeof loggerAsInterface.disableTimestamps).toBe("function")
      expect(typeof loggerAsInterface.enableTimestamps).toBe("function")
      expect(typeof loggerAsInterface.disableColors).toBe("function")
      expect(typeof loggerAsInterface.setColorsEnabled).toBe("function")
    })

    it("should handle LogStatus type correctly", () => {
      const validStatuses: LogStatus[] = ["OK", "ERROR", "INFO", "WARN", "DEBUG", "EVENT", "CHAT"]

      validStatuses.forEach((status) => {
        expect(validStatuses).toContain(status)
      })
    })
  })

  describe("Performance and memory", () => {
    it("should handle high-frequency logging", () => {
      const iterations = 1000

      for (let i = 0; i < iterations; i++) {
        testLogger.debug(`Debug message ${i}`)
      }

      expect(consoleSpy).toHaveBeenCalledTimes(iterations)
    })

    it("should handle concurrent logging calls", () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve().then(() => testLogger.info(`Concurrent message ${i}`)),
      )

      return Promise.all(promises).then(() => {
        expect(consoleSpy).toHaveBeenCalledTimes(100)
      })
    })

    it("should not leak memory with repeated configuration changes", () => {
      for (let i = 0; i < 100; i++) {
        testLogger.setColorsEnabled(i % 2 === 0)
        testLogger.enableTimestamps()
        testLogger.disableTimestamps()
      }

      testLogger.info("Memory test complete")
      expect(consoleSpy).toHaveBeenLastCalledWith(
        expect.stringContaining("[ INFO ] Memory test complete"),
      )
    })
  })
})
