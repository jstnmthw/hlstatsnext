import { describe, it, expect, vi, afterEach } from "vitest"
import { Logger } from "@/utils/logger"
import { PlayerHandler } from "@/services/processor/handlers/player.handler"
import { type GameEvent } from "@/types/common/events"
import type { DatabaseClient } from "@/database/client"

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
  ]

  it.each(STATUSES)("should format %s logs correctly (no timestamp, no colors)", ({ name, method }) => {
    const testLogger = new Logger({ enableColors: false, showTimestamp: false })
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    const msg = `Test ${name} message`
    method(testLogger, msg)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toBe(`[ ${name} ] ${msg}`)
  })
})

describe("PlayerHandler logging", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("should emit an EVENT log when a kill is successfully recorded", async () => {
    // Spy on console.log used by global logger instance
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined)

    // Mock DatabaseClient with minimal functionality
    const dbMock = {
      getPlayerStats: vi.fn().mockResolvedValue({ skill: 100, kill_streak: 0, death_streak: 0 }),
      updatePlayerStats: vi.fn().mockResolvedValue(undefined),
    } as unknown as DatabaseClient

    const handler = new PlayerHandler(dbMock)

    const event: GameEvent = {
      eventType: "PLAYER_KILL",
      timestamp: new Date(),
      serverId: 1,
      data: {
        killerId: 1,
        victimId: 2,
        weapon: "ak47",
        headshot: false,
      },
    } as unknown as GameEvent

    await handler.handleEvent(event)

    // Expect at least one log containing our EVENT tag and kill message
    const logged = spy.mock.calls.map((c) => stripAnsi(c[0]))
    const match = logged.find((l) => l.includes("[ EVENT ]") && l.includes("Kill recorded"))

    expect(match, "Expected an EVENT log for Kill recorded").toBeDefined()
  })
})
