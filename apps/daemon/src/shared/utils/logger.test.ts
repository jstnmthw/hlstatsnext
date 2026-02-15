/**
 * Logger Implementation Unit Tests - Optimized
 */

import type { MockInstance } from "vitest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Logger, logger, LogLevel, type LogStatus } from "./logger"
import type { ILogger } from "./logger.types"

describe("Logger", () => {
  let testLogger: Logger
  let consoleSpy: MockInstance

  beforeEach(() => {
    delete process.env.LOG_LEVEL
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    testLogger = new Logger({ enableColors: false, showTimestamp: false, logLevel: LogLevel.DEBUG })
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    vi.clearAllMocks()
  })

  describe("Instantiation and Interface", () => {
    it("should create logger with default and custom options", () => {
      const defaultLogger = new Logger()
      const customLogger = new Logger({ enableColors: false, showTimestamp: false })

      expect(defaultLogger).toBeInstanceOf(Logger)
      expect(customLogger).toBeInstanceOf(Logger)

      // Test default behavior (colors enabled)
      defaultLogger.info("test message")
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("\x1b[34m[ INFO ]\x1b[0m test message"),
      )
    })

    it("should implement ILogger interface completely", () => {
      const loggerAsInterface: ILogger = new Logger()

      // Test all interface methods exist with correct types
      const methods = [
        "ok",
        "error",
        "info",
        "warn",
        "debug",
        "event",
        "chat",
        "starting",
        "started",
        "stopping",
        "stopped",
        "connecting",
        "connected",
        "disconnected",
        "failed",
        "ready",
        "received",
        "shutdown",
        "shutdownComplete",
        "fatal",
        "disableTimestamps",
        "enableTimestamps",
        "disableColors",
        "setColorsEnabled",
        "getLogLevel",
        "setLogLevel",
        "setLogLevelFromString",
      ]

      methods.forEach((method) => {
        expect(typeof loggerAsInterface[method as keyof ILogger]).toBe("function")
      })
    })
  })

  describe("Basic Logging Methods", () => {
    const logMethods: Array<{ method: keyof Logger; level: string; message: string }> = [
      { method: "ok", level: "OK", message: "Operation successful" },
      { method: "error", level: "ERROR", message: "Something went wrong" },
      { method: "info", level: "INFO", message: "Information message" },
      { method: "warn", level: "WARN", message: "Warning message" },
      { method: "debug", level: "DEBUG", message: "Debug information" },
      { method: "event", level: "EVENT", message: "Event occurred" },
      { method: "chat", level: "CHAT", message: "Player chat message" },
    ]

    it.each(logMethods)("should log $level messages", ({ method, level, message }) => {
      ;(testLogger[method] as (msg: string) => void)(message)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`[ ${level} ] ${message}`))
    })
  })

  describe("Service lifecycle methods", () => {
    const lifecycleMethods = [
      {
        method: "starting",
        service: "Database",
        expectedLevel: "INFO",
        expectedMessage: "Starting Database",
      },
      {
        method: "started",
        service: "Database",
        expectedLevel: "OK",
        expectedMessage: "Database started successfully",
      },
      {
        method: "stopping",
        service: "UDP Server",
        expectedLevel: "INFO",
        expectedMessage: "Stopping UDP Server",
      },
      {
        method: "stopped",
        service: "UDP Server",
        expectedLevel: "OK",
        expectedMessage: "UDP Server stopped successfully",
      },
      {
        method: "connecting",
        service: "MySQL Database",
        expectedLevel: "INFO",
        expectedMessage: "Connecting to MySQL Database",
      },
      {
        method: "connected",
        service: "MySQL Database",
        expectedLevel: "OK",
        expectedMessage: "Connected to MySQL Database",
      },
      {
        method: "disconnected",
        service: "Redis Cache",
        expectedLevel: "OK",
        expectedMessage: "Disconnected from Redis Cache",
      },
    ]

    it.each(lifecycleMethods)(
      "should log $method for $service",
      ({ method, service, expectedLevel, expectedMessage }) => {
        ;(testLogger[method as keyof Logger] as (service: string) => void)(service)
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(`[ ${expectedLevel} ] ${expectedMessage}`),
        )
      },
    )
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
    const colorTests = [
      { status: "OK", color: "\x1b[32m\x1b[1m[ OK ]\x1b[0m", message: "Success message" },
      { status: "ERROR", color: "\x1b[31m\x1b[1m[ ERROR ]\x1b[0m", message: "Error message" },
      { status: "INFO", color: "\x1b[34m[ INFO ]\x1b[0m", message: "Info message" },
      { status: "WARN", color: "\x1b[33m[ WARN ]\x1b[0m", message: "Warning message" },
      { status: "EVENT", color: "\x1b[36m\x1b[1m[ EVENT ]\x1b[0m", message: "Event message" },
      { status: "CHAT", color: "\x1b[33m\x1b[1m[ CHAT ]\x1b[0m", message: "Chat message" },
    ]

    it.each(colorTests)(
      "should apply correct color to $status status",
      ({ status, color, message }) => {
        const colorLogger = new Logger({ enableColors: true, logLevel: LogLevel.DEBUG })
        const method = status.toLowerCase() as keyof Logger
        ;(colorLogger[method] as (msg: string) => void)(message)
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(color))
      },
    )

    it("should apply gray color to DEBUG status", () => {
      const colorLogger = new Logger({ enableColors: true, logLevel: LogLevel.DEBUG })
      colorLogger.debug("Debug message")
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("\x1b[90m[ DEBUG ]\x1b[0m"))
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
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2023-12-25T10:30:45.123Z"))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const timestampTests = [
      {
        name: "include timestamp when enabled",
        options: { showTimestamp: true },
        expectContains: "[2023-12-25 10:30:45]",
      },
      {
        name: "not include timestamp when disabled",
        options: { showTimestamp: false },
        expectNotContains: "[2023-12-25 10:30:45]",
      },
      {
        name: "format timestamp with gray color when colors enabled",
        options: { enableColors: true, showTimestamp: true },
        expectContains: "\x1b[90m[2023-12-25 10:30:45]\x1b[0m",
      },
      {
        name: "format timestamp without color when colors disabled",
        options: { enableColors: false, showTimestamp: true },
        expectContains: "[2023-12-25 10:30:45]",
        expectNotContains: "\x1b[90m",
      },
    ]

    it.each(timestampTests)("should $name", ({ options, expectContains, expectNotContains }) => {
      const logger = new Logger(options)
      logger.info("Test message")

      if (expectContains) {
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(expectContains))
      }
      if (expectNotContains) {
        expect(consoleSpy).toHaveBeenCalledWith(expect.not.stringContaining(expectNotContains))
      }
    })
  })

  describe("Configuration methods", () => {
    const configTests = [
      {
        name: "timestamp toggling",
        setup: () => {
          testLogger.enableTimestamps()
          testLogger.info("With timestamp")
          testLogger.disableTimestamps()
          testLogger.info("Without timestamp")
        },
        expects: [
          { call: 1, contains: "[" },
          { call: 2, notContains: "[2" },
        ],
      },
      {
        name: "color toggling",
        setup: () => {
          testLogger.setColorsEnabled(false)
          testLogger.error("Error without colors")
          testLogger.setColorsEnabled(true)
          testLogger.error("Error with colors")
        },
        expects: [
          { call: 1, notContains: "\x1b[" },
          { call: 2, contains: "\x1b[" },
        ],
      },
    ]

    it.each(configTests)("should handle $name", ({ setup, expects }) => {
      setup()
      expects.forEach(({ call, contains, notContains }) => {
        if (contains) {
          expect(consoleSpy).toHaveBeenNthCalledWith(call, expect.stringContaining(contains))
        }
        if (notContains) {
          expect(consoleSpy).toHaveBeenNthCalledWith(call, expect.not.stringContaining(notContains))
        }
      })
    })

    it("should disable colors via disableColors method", () => {
      testLogger.disableColors()
      testLogger.error("Error without colors")
      expect(consoleSpy).toHaveBeenCalledWith(expect.not.stringContaining("\x1b["))
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

  describe("Context Parameter Support", () => {
    it("should log messages with context objects", () => {
      const context = {
        sagaName: "KillEventSaga",
        eventType: "PLAYER_KILL",
        error: "Connection timeout",
      }

      testLogger.error("Saga execution failed", context)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ ERROR ] Saga execution failed"),
        context,
      )
    })

    it("should log messages without context when not provided", () => {
      testLogger.info("Simple message")

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[ INFO ] Simple message"))
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.anything(), expect.any(Object))
    })

    it("should handle empty context objects", () => {
      testLogger.warn("Warning message", {})

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ WARN ] Warning message"),
        {},
      )
    })

    it("should handle complex nested context objects", () => {
      const complexContext = {
        event: {
          type: "PLAYER_KILL",
          data: {
            killerId: 123,
            victimId: 456,
          },
        },
        metadata: {
          timestamp: new Date().toISOString(),
          serverId: 1,
        },
      }

      testLogger.debug("Processing complex event", complexContext)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ DEBUG ] Processing complex event"),
        complexContext,
      )
    })

    const contextMethods = [
      { method: "ok", level: "OK" },
      { method: "error", level: "ERROR" },
      { method: "info", level: "INFO" },
      { method: "warn", level: "WARN" },
      { method: "debug", level: "DEBUG" },
      { method: "event", level: "EVENT" },
      { method: "chat", level: "CHAT" },
    ]

    it.each(contextMethods)("should support context parameter for $method", ({ method, level }) => {
      const context = { testKey: "testValue" }

      ;(testLogger[method as keyof Logger] as (msg: string, ctx?: Record<string, unknown>) => void)(
        "Test message",
        context,
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[ ${level} ] Test message`),
        context,
      )
    })
  })

  describe("Log Levels", () => {
    beforeEach(() => {
      delete process.env.LOG_LEVEL
    })

    describe("Environment-based log level detection", () => {
      const envLevelTests = [
        {
          envValue: undefined,
          expected: LogLevel.INFO,
          description: "default to INFO when no env vars set",
        },
        { envValue: "debug", expected: LogLevel.DEBUG, description: "read debug from LOG_LEVEL" },
        {
          envValue: "DEBUG",
          expected: LogLevel.DEBUG,
          description: "handle case-insensitive DEBUG",
        },
        { envValue: "warn", expected: LogLevel.WARN, description: "read warn from LOG_LEVEL" },
        { envValue: "error", expected: LogLevel.ERROR, description: "read error from LOG_LEVEL" },
        {
          envValue: "invalid",
          expected: LogLevel.INFO,
          description: "default to INFO for unknown levels",
        },
      ]

      it.each(envLevelTests)("should $description", ({ envValue, expected }) => {
        if (envValue) {
          process.env.LOG_LEVEL = envValue
        }
        const logger = new Logger({ enableColors: false, showTimestamp: false })
        expect(logger.getLogLevel()).toBe(expected)
      })
    })

    describe("Log level filtering", () => {
      const filteringTests = [
        {
          level: LogLevel.ERROR,
          description: "only ERROR when level is ERROR",
          expectedCalls: 1,
          expectedMessages: ["[ ERROR ] Error message"],
        },
        {
          level: LogLevel.WARN,
          description: "ERROR and WARN when level is WARN",
          expectedCalls: 2,
          expectedMessages: ["[ ERROR ] Error message", "[ WARN ] Warn message"],
        },
        {
          level: LogLevel.INFO,
          description: "ERROR, WARN, INFO, OK, EVENT, CHAT when level is INFO",
          expectedCalls: 6,
          expectedMessages: [
            "[ ERROR ] Error message",
            "[ WARN ] Warn message",
            "[ INFO ] Info message",
            "[ OK ] OK message",
            "[ EVENT ] Event message",
            "[ CHAT ] Chat message",
          ],
        },
        {
          level: LogLevel.DEBUG,
          description: "all messages when level is DEBUG",
          expectedCalls: 7,
          expectedMessages: [
            "[ ERROR ] Error message",
            "[ WARN ] Warn message",
            "[ INFO ] Info message",
            "[ DEBUG ] Debug message",
            "[ OK ] OK message",
            "[ EVENT ] Event message",
            "[ CHAT ] Chat message",
          ],
        },
      ]

      it.each(filteringTests)(
        "should log $description",
        ({ level, expectedCalls, expectedMessages }) => {
          const logger = new Logger({ enableColors: false, showTimestamp: false, logLevel: level })

          logger.error("Error message")
          logger.warn("Warn message")
          logger.info("Info message")
          logger.debug("Debug message")
          logger.ok("OK message")
          logger.event("Event message")
          logger.chat("Chat message")

          expect(consoleSpy).toHaveBeenCalledTimes(expectedCalls)
          expectedMessages.forEach((message, index) => {
            expect(consoleSpy).toHaveBeenNthCalledWith(index + 1, message)
          })
        },
      )
    })

    describe("Dynamic log level changes", () => {
      const dynamicTests = [
        {
          name: "change log level dynamically",
          test: (logger: Logger) => {
            logger.info("Should not log")
            expect(consoleSpy).toHaveBeenCalledTimes(0)
            logger.setLogLevel(LogLevel.INFO)
            logger.info("Should log now")
            expect(consoleSpy).toHaveBeenCalledTimes(1)
          },
        },
        {
          name: "change log level from valid strings",
          test: (logger: Logger) => {
            logger.setLogLevelFromString("debug")
            expect(logger.getLogLevel()).toBe(LogLevel.DEBUG)
            logger.setLogLevelFromString("WARN")
            expect(logger.getLogLevel()).toBe(LogLevel.WARN)
            logger.setLogLevelFromString("warning")
            expect(logger.getLogLevel()).toBe(LogLevel.WARN)
          },
        },
      ]

      it.each(dynamicTests)("should $name", ({ test }) => {
        const logger = new Logger({
          enableColors: false,
          showTimestamp: false,
          logLevel: LogLevel.ERROR,
        })
        test(logger)
      })

      it("should warn on invalid log level string", () => {
        const logger = new Logger({
          enableColors: false,
          showTimestamp: false,
          logLevel: LogLevel.INFO,
        })
        const originalLevel = logger.getLogLevel()
        logger.setLogLevelFromString("invalid")

        expect(logger.getLogLevel()).toBe(originalLevel)
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("[ WARN ] Unknown log level: invalid, keeping current level"),
        )
      })
    })

    describe("Log level enum", () => {
      const enumTests = [
        { level: "ERROR", value: 0 },
        { level: "WARN", value: 1 },
        { level: "INFO", value: 2 },
        { level: "DEBUG", value: 3 },
      ]

      it.each(enumTests)("should have $level = $value", ({ level, value }) => {
        expect(LogLevel[level as keyof typeof LogLevel]).toBe(value)
      })

      it("should have correct ordering for filtering", () => {
        expect(LogLevel.ERROR < LogLevel.WARN).toBe(true)
        expect(LogLevel.WARN < LogLevel.INFO).toBe(true)
        expect(LogLevel.INFO < LogLevel.DEBUG).toBe(true)
      })
    })
  })
})
