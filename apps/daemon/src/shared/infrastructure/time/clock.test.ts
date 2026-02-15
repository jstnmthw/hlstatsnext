/**
 * Clock Service Tests
 *
 * Comprehensive tests for both SystemClock and TestClock implementations
 */

import { beforeEach, describe, expect, it } from "vitest"
import type { IClock } from "./clock.interface"
import { SystemClock } from "./system-clock"
import { TestClock } from "./test-clock"

describe("SystemClock", () => {
  let systemClock: SystemClock

  beforeEach(() => {
    systemClock = new SystemClock()
  })

  describe("now()", () => {
    it("should return current Date", () => {
      const before = new Date()
      const now = systemClock.now()
      const after = new Date()

      expect(now).toBeInstanceOf(Date)
      expect(now.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(now.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })

  describe("timestamp()", () => {
    it("should return current timestamp", () => {
      const before = Date.now()
      const timestamp = systemClock.timestamp()
      const after = Date.now()

      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe("isoString()", () => {
    it("should return valid ISO string", () => {
      const isoString = systemClock.isoString()

      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(new Date(isoString)).toBeInstanceOf(Date)
      expect(new Date(isoString).toISOString()).toBe(isoString)
    })
  })

  describe("fromTimestamp()", () => {
    it("should convert timestamp to Date", () => {
      const timestamp = 1640995200000 // 2022-01-01T00:00:00.000Z
      const date = systemClock.fromTimestamp(timestamp)

      expect(date).toBeInstanceOf(Date)
      expect(date.getTime()).toBe(timestamp)
      expect(date.toISOString()).toBe("2022-01-01T00:00:00.000Z")
    })
  })

  describe("sleep()", () => {
    it("should sleep for specified milliseconds", async () => {
      const start = Date.now()
      await systemClock.sleep(50)
      const end = Date.now()

      expect(end - start).toBeGreaterThanOrEqual(45) // Allow some tolerance
      expect(end - start).toBeLessThan(100)
    })
  })
})

describe("TestClock", () => {
  let testClock: TestClock

  beforeEach(() => {
    testClock = new TestClock()
  })

  describe("constructor", () => {
    it("should initialize with default test time", () => {
      const clock = new TestClock()
      expect(clock.now()).toEqual(new Date("2024-01-01T00:00:00.000Z"))
    })

    it("should initialize with provided Date", () => {
      const initialDate = new Date("2023-06-15T12:30:45.000Z")
      const clock = new TestClock(initialDate)
      expect(clock.now()).toEqual(initialDate)
    })

    it("should initialize with provided timestamp", () => {
      const timestamp = 1640995200000 // 2022-01-01T00:00:00.000Z
      const clock = new TestClock(timestamp)
      expect(clock.now()).toEqual(new Date(timestamp))
    })
  })

  describe("deterministic behavior", () => {
    it("should return same time on multiple calls", () => {
      const time1 = testClock.now()
      const time2 = testClock.now()
      const time3 = testClock.now()

      expect(time1).toEqual(time2)
      expect(time2).toEqual(time3)
    })

    it("should return consistent timestamp", () => {
      const timestamp1 = testClock.timestamp()
      const timestamp2 = testClock.timestamp()

      expect(timestamp1).toBe(timestamp2)
    })

    it("should return consistent ISO string", () => {
      const iso1 = testClock.isoString()
      const iso2 = testClock.isoString()

      expect(iso1).toBe(iso2)
      expect(iso1).toBe("2024-01-01T00:00:00.000Z")
    })
  })

  describe("advance()", () => {
    it("should advance time by specified milliseconds", () => {
      const initial = testClock.now()
      testClock.advance(5000)
      const advanced = testClock.now()

      expect(advanced.getTime() - initial.getTime()).toBe(5000)
    })

    it("should affect all time methods", () => {
      testClock.advance(60000) // 1 minute

      expect(testClock.now()).toEqual(new Date("2024-01-01T00:01:00.000Z"))
      expect(testClock.timestamp()).toBe(new Date("2024-01-01T00:01:00.000Z").getTime())
      expect(testClock.isoString()).toBe("2024-01-01T00:01:00.000Z")
    })
  })

  describe("setTime()", () => {
    it("should set time to specific Date", () => {
      const newTime = new Date("2023-12-25T10:30:15.000Z")
      testClock.setTime(newTime)

      expect(testClock.now()).toEqual(newTime)
    })

    it("should set time to specific timestamp", () => {
      const timestamp = 1640995200000
      testClock.setTime(timestamp)

      expect(testClock.now()).toEqual(new Date(timestamp))
      expect(testClock.timestamp()).toBe(timestamp)
    })
  })

  describe("reset()", () => {
    it("should reset to default test time", () => {
      testClock.advance(100000)
      testClock.reset()

      expect(testClock.now()).toEqual(new Date("2024-01-01T00:00:00.000Z"))
    })
  })

  describe("peek()", () => {
    it("should return current time without affecting clock", () => {
      const peek1 = testClock.peek()
      const peek2 = testClock.peek()
      const now = testClock.now()

      expect(peek1).toEqual(peek2)
      expect(peek1).toEqual(now)
    })
  })

  describe("sleep()", () => {
    it("should advance time instead of actually sleeping", async () => {
      const before = testClock.now()
      await testClock.sleep(1000)
      const after = testClock.now()

      expect(after.getTime() - before.getTime()).toBe(1000)
    })

    it("should resolve immediately", async () => {
      const start = Date.now()
      await testClock.sleep(5000) // Would normally take 5 seconds
      const end = Date.now()

      expect(end - start).toBeLessThan(10) // Should be nearly instant
    })
  })

  describe("fromTimestamp()", () => {
    it("should convert timestamp to Date correctly", () => {
      const timestamp = 1640995200000
      const date = testClock.fromTimestamp(timestamp)

      expect(date).toEqual(new Date(timestamp))
      expect(date.getTime()).toBe(timestamp)
    })
  })
})

describe("Clock Interface Compliance", () => {
  const clocks: [string, IClock][] = [
    ["SystemClock", new SystemClock()],
    ["TestClock", new TestClock()],
  ]

  clocks.forEach(([name, clock]) => {
    describe(`${name} interface compliance`, () => {
      it("should implement all IClock methods", () => {
        expect(typeof clock.now).toBe("function")
        expect(typeof clock.timestamp).toBe("function")
        expect(typeof clock.isoString).toBe("function")
        expect(typeof clock.fromTimestamp).toBe("function")
        expect(typeof clock.sleep).toBe("function")
      })

      it("should return consistent types", () => {
        expect(clock.now()).toBeInstanceOf(Date)
        expect(typeof clock.timestamp()).toBe("number")
        expect(typeof clock.isoString()).toBe("string")
        expect(clock.fromTimestamp(1640995200000)).toBeInstanceOf(Date)
      })

      it("should handle sleep method", async () => {
        await expect(clock.sleep(1)).resolves.toBeUndefined()
      })
    })
  })
})

describe("Clock Integration Scenarios", () => {
  describe("time progression testing", () => {
    it("should allow controlled time progression in tests", () => {
      const testClock = new TestClock(new Date("2024-01-01T00:00:00.000Z"))

      // Simulate a process that takes time
      const events: string[] = []

      events.push(`Started: ${testClock.isoString()}`)
      testClock.advance(1000)

      events.push(`Processing: ${testClock.isoString()}`)
      testClock.advance(2000)

      events.push(`Completed: ${testClock.isoString()}`)

      expect(events).toEqual([
        "Started: 2024-01-01T00:00:00.000Z",
        "Processing: 2024-01-01T00:00:01.000Z",
        "Completed: 2024-01-01T00:00:03.000Z",
      ])
    })
  })

  describe("timestamp calculations", () => {
    it("should handle time differences correctly", () => {
      const testClock = new TestClock()

      const start = testClock.timestamp()
      testClock.advance(5000)
      const end = testClock.timestamp()

      expect(end - start).toBe(5000)
    })
  })

  describe("date formatting consistency", () => {
    it("should maintain ISO format consistency", () => {
      const testClock = new TestClock(new Date("2023-07-15T14:30:25.123Z"))

      expect(testClock.isoString()).toBe("2023-07-15T14:30:25.123Z")
      expect(testClock.now().toISOString()).toBe("2023-07-15T14:30:25.123Z")
    })
  })
})
