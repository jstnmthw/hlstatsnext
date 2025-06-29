import { describe, it, expect, vi, afterEach } from "vitest"
import { Logger } from "@/utils/logger"
import { PlayerHandler } from "@/services/processor/handlers/player.handler"
import { type GameEvent } from "@/types/common/events"
import type { DatabaseClient } from "@/database/client"
import { PlayerService } from "@/services/player/player.service"

/* eslint-disable no-control-regex */ // Allow ANSI escape regex used in test helper
// Utility to strip ANSI color codes for easier assertions
const stripAnsi = (str: string): string => str.replace(/\u001b\[[0-9;]*m/g, "")

describe("Logger", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const STATUSES: Array<{ name: string; method: (l: Logger, m: string) => void }> = [
    { name: "OK", method: (l, m) => l.ok(m) },
    { name: "ERROR", method: (l, m) => l.error(m) },
    { name: "INFO", method: (l, m) => l.info(m) },
    { name: "WARN", method: (l, m) => l.warn(m) },
    { name: "DEBUG", method: (l, m) => l.debug(m) },
    { name: "EVENT", method: (l, m) => l.event(m) },
    { name: "CHAT", method: (l, m) => l.chat(m) },
  ]

  it.each(STATUSES)("should format %s logs correctly (no timestamp, no colors)", ({ name, method }) => {
    const testLogger = new Logger({ enableColors: false, showTimestamp: false })
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    const msg = `Test ${name} message`
    method(testLogger, msg)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toBe(`[ ${name} ] ${msg}`)
  })

  it.each(STATUSES)("should format %s logs correctly (with colors, no timestamp)", ({ name, method }) => {
    const testLogger = new Logger({ enableColors: true, showTimestamp: false })
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    const msg = `Test ${name} message`
    method(testLogger, msg)

    expect(spy).toHaveBeenCalledTimes(1)

    const loggedMessage = spy.mock.calls[0]![0] as string
    expect(loggedMessage).toContain(`[ ${name} ]`)
    expect(loggedMessage).toContain(msg)

    // Should contain ANSI color codes when colors are enabled
    expect(loggedMessage).toMatch(/\u001b\[[0-9;]*m/)
  })

  it("should include timestamp when enabled", () => {
    const testLogger = new Logger({ enableColors: false, showTimestamp: true })
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    testLogger.info("Test message")

    expect(spy).toHaveBeenCalledTimes(1)
    const loggedMessage = spy.mock.calls[0]![0] as string

    // Should match timestamp format: [YYYY-MM-DD HH:MM:SS]
    expect(loggedMessage).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/)
  })

  it("should format timestamp with colors when both enabled", () => {
    const testLogger = new Logger({ enableColors: true, showTimestamp: true })
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    testLogger.info("Test message")

    expect(spy).toHaveBeenCalledTimes(1)
    const loggedMessage = spy.mock.calls[0]![0] as string

    // Should contain timestamp with ANSI color codes
    expect(loggedMessage).toMatch(/\u001b\[90m\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]\u001b\[0m/)
  })

  describe("Service lifecycle methods", () => {
    it("should log starting service", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.starting("Database Service")

      expect(spy).toHaveBeenCalledWith("[ INFO ] Starting Database Service")
    })

    it("should log started service", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.started("Database Service")

      expect(spy).toHaveBeenCalledWith("[ OK ] Database Service started successfully")
    })

    it("should log stopping service", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.stopping("Database Service")

      expect(spy).toHaveBeenCalledWith("[ INFO ] Stopping Database Service")
    })

    it("should log stopped service", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.stopped("Database Service")

      expect(spy).toHaveBeenCalledWith("[ OK ] Database Service stopped successfully")
    })
  })

  describe("Connection methods", () => {
    it("should log connecting", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.connecting("MySQL Database")

      expect(spy).toHaveBeenCalledWith("[ INFO ] Connecting to MySQL Database")
    })

    it("should log connected", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.connected("MySQL Database")

      expect(spy).toHaveBeenCalledWith("[ OK ] Connected to MySQL Database")
    })

    it("should log disconnected", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.disconnected("MySQL Database")

      expect(spy).toHaveBeenCalledWith("[ OK ] Disconnected from MySQL Database")
    })
  })

  describe("Error and status methods", () => {
    it("should log failed operation without error details", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.failed("Database connection")

      expect(spy).toHaveBeenCalledWith("[ ERROR ] Database connection")
    })

    it("should log failed operation with error details", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.failed("Database connection", "Connection timeout")

      expect(spy).toHaveBeenCalledWith("[ ERROR ] Database connection: Connection timeout")
    })

    it("should log ready message", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.ready("Server is ready to accept connections")

      expect(spy).toHaveBeenCalledWith("[ OK ] Server is ready to accept connections")
    })

    it("should log received signal", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.received("SIGTERM")

      expect(spy).toHaveBeenCalledWith("[ INFO ] Received SIGTERM, shutting down gracefully")
    })

    it("should log shutdown", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.shutdown()

      expect(spy).toHaveBeenCalledWith("[ INFO ] Shutting down HLStats Daemon v2")
    })

    it("should log shutdown complete", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.shutdownComplete()

      expect(spy).toHaveBeenCalledWith("[ OK ] Daemon shutdown complete")
    })

    it("should log fatal error", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.fatal("Critical system failure")

      expect(spy).toHaveBeenCalledWith("[ ERROR ] Fatal error: Critical system failure")
    })
  })

  describe("Configuration methods", () => {
    it("should toggle timestamps on and off", () => {
      const testLogger = new Logger({ enableColors: false, showTimestamp: true })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      // Initially with timestamp
      testLogger.info("With timestamp")
      expect(spy.mock.calls[0]![0]).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/)

      spy.mockClear()

      // Disable timestamps
      testLogger.disableTimestamps()
      testLogger.info("Without timestamp")
      expect(spy.mock.calls[0]![0]).toBe("[ INFO ] Without timestamp")

      spy.mockClear()

      // Re-enable timestamps
      testLogger.enableTimestamps()
      testLogger.info("With timestamp again")
      expect(spy.mock.calls[0]![0]).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/)
    })

    it("should toggle colors on and off", () => {
      const testLogger = new Logger({ enableColors: true, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      // Initially with colors
      testLogger.info("With colors")
      expect(spy.mock.calls[0]![0]).toMatch(/\u001b\[[0-9;]*m/)

      spy.mockClear()

      // Disable colors
      testLogger.disableColors()
      testLogger.info("Without colors")
      expect(spy.mock.calls[0]![0]).toBe("[ INFO ] Without colors")

      spy.mockClear()

      // Re-enable colors via setColorsEnabled
      testLogger.setColorsEnabled(true)
      testLogger.info("With colors again")
      expect(spy.mock.calls[0]![0]).toMatch(/\u001b\[[0-9;]*m/)
    })

    it("should handle setColorsEnabled with false", () => {
      const testLogger = new Logger({ enableColors: true, showTimestamp: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.setColorsEnabled(false)
      testLogger.info("No colors")
      expect(spy.mock.calls[0]![0]).toBe("[ INFO ] No colors")
    })
  })

  describe("Constructor options", () => {
    it("should use default options when none provided", () => {
      const testLogger = new Logger()
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.info("Default config")

      expect(spy).toHaveBeenCalledTimes(1)
      const loggedMessage = spy.mock.calls[0]![0] as string

      // Should have timestamp and colors by default
      expect(loggedMessage).toMatch(/\u001b\[90m\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]\u001b\[0m/)
      expect(loggedMessage).toMatch(/\u001b\[34m\[ INFO \]\u001b\[0m/)
    })

    it("should respect partial options", () => {
      const testLogger = new Logger({ enableColors: false })
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

      testLogger.info("Partial config")

      expect(spy).toHaveBeenCalledTimes(1)
      const loggedMessage = spy.mock.calls[0]![0] as string

      // Should have timestamp (default true) but no colors
      expect(loggedMessage).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[ INFO \]/)
      expect(loggedMessage).not.toMatch(/\u001b\[[0-9;]*m/)
    })
  })
})

describe("PlayerHandler logging", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it("should emit an EVENT log when a kill is successfully recorded", async () => {
    // Spy on console.log used by global logger instance
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    // Create mock PlayerService using clean dependency injection
    const mockPlayerService = {
      getPlayerStats: vi
        .fn()
        .mockResolvedValueOnce({ skill: 1000, kill_streak: 0, death_streak: 0 }) // killer stats
        .mockResolvedValueOnce({ skill: 1000, kill_streak: 0, death_streak: 0 }) // victim stats
        .mockResolvedValueOnce({ skill: 1000, kill_streak: 0, death_streak: 0 }) // killer stats for skill calculation
        .mockResolvedValueOnce({ skill: 1000, kill_streak: 0, death_streak: 0 }), // victim stats for skill calculation
      updatePlayerStats: vi.fn().mockResolvedValue(undefined),
      getOrCreatePlayer: vi.fn(),
      getPlayerRating: vi.fn(),
      updatePlayerRatings: vi.fn(),
      getRoundParticipants: vi.fn(),
      getTopPlayers: vi.fn(),
    } as unknown as PlayerService

    // Mock DatabaseClient constructor
    const dbMock = {
      prisma: {},
      testConnection: vi.fn(),
      transaction: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as DatabaseClient

    // Use clean dependency injection!
    const handler = new PlayerHandler(dbMock, mockPlayerService)

    const event: GameEvent = {
      eventType: "PLAYER_KILL",
      timestamp: new Date(),
      serverId: 1,
      data: {
        killerId: 1,
        victimId: 2,
        weapon: "ak47",
        headshot: false,
        killerTeam: "CT",
        victimTeam: "T",
      },
    } as unknown as GameEvent

    await handler.handleEvent(event)

    // Check what was logged
    const logged = spy.mock.calls.map((c) => stripAnsi(c[0]))

    // Expect at least one log containing our EVENT tag and kill message
    const match = logged.find((l) => l.includes("[ EVENT ]") && l.includes("Kill recorded"))

    expect(match, `Expected an EVENT log for Kill recorded. Actual logs: ${JSON.stringify(logged)}`).toBeDefined()
  })
})
