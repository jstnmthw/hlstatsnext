/**
 * Player Name Validator Tests
 *
 * Comprehensive tests for player name validation and sanitization utilities.
 */

import { describe, expect, it } from "vitest"
import {
  sanitizePlayerName,
  sanitizePlayerNameStatsUpdate,
  validateNameConnectionTime,
  validateNameShotStats,
  validateNameStatValue,
  validatePlayerId,
  validatePlayerName,
  validatePlayerNameStatsUpdate,
  validateUsageCount,
} from "./player-name.validator"

// -------------------------------------------------------------------
// validatePlayerName
// -------------------------------------------------------------------
describe("validatePlayerName", () => {
  it("should accept valid player names", () => {
    expect(validatePlayerName("Player")).toBe(true)
    expect(validatePlayerName("Player_123")).toBe(true)
    expect(validatePlayerName("A")).toBe(true) // minimum length
    expect(validatePlayerName("A".repeat(64))).toBe(true) // exact max length
  })

  it("should throw for empty string", () => {
    expect(() => validatePlayerName("")).toThrow("non-empty string")
  })

  it("should throw for non-string values", () => {
    expect(() => validatePlayerName(null as any)).toThrow("non-empty string")
    expect(() => validatePlayerName(undefined as any)).toThrow("non-empty string")
    expect(() => validatePlayerName(123 as any)).toThrow("non-empty string")
  })

  it("should throw for names exceeding 64 characters", () => {
    expect(() => validatePlayerName("A".repeat(65))).toThrow("between 1 and 64")
  })

  it("should throw for names with control characters (\\x00-\\x1f)", () => {
    expect(() => validatePlayerName("Player\x00")).toThrow("control characters")
    expect(() => validatePlayerName("Player\x0a")).toThrow("control characters")
    expect(() => validatePlayerName("Player\x1f")).toThrow("control characters")
  })

  it("should throw for names with DEL character (\\x7f)", () => {
    expect(() => validatePlayerName("Player\x7f")).toThrow("control characters")
  })

  it("should accept names with spaces and special printable characters", () => {
    expect(validatePlayerName("Player Name")).toBe(true)
    expect(validatePlayerName("[TAG] Player!")).toBe(true)
    expect(validatePlayerName("  Spaced  ")).toBe(true)
  })
})

// -------------------------------------------------------------------
// validatePlayerId
// -------------------------------------------------------------------
describe("validatePlayerId", () => {
  it("should accept valid positive integers", () => {
    expect(validatePlayerId(1)).toBe(true)
    expect(validatePlayerId(100)).toBe(true)
    expect(validatePlayerId(999999)).toBe(true)
  })

  it("should throw for zero", () => {
    expect(() => validatePlayerId(0)).toThrow("positive integer")
  })

  it("should throw for negative values", () => {
    expect(() => validatePlayerId(-1)).toThrow("positive integer")
    expect(() => validatePlayerId(-100)).toThrow("positive integer")
  })

  it("should throw for non-integer values", () => {
    expect(() => validatePlayerId(1.5)).toThrow("positive integer")
    expect(() => validatePlayerId(NaN)).toThrow("positive integer")
  })
})

// -------------------------------------------------------------------
// validateUsageCount
// -------------------------------------------------------------------
describe("validateUsageCount", () => {
  it("should accept valid non-negative integers", () => {
    expect(validateUsageCount(0, "numUses")).toBe(true)
    expect(validateUsageCount(50, "numUses")).toBe(true)
    expect(validateUsageCount(100000, "numUses")).toBe(true) // exact max
  })

  it("should throw for negative values", () => {
    expect(() => validateUsageCount(-1, "numUses")).toThrow("non-negative integer")
  })

  it("should throw for non-integer values", () => {
    expect(() => validateUsageCount(1.5, "numUses")).toThrow("non-negative integer")
    expect(() => validateUsageCount(NaN, "numUses")).toThrow("non-negative integer")
  })

  it("should throw for values exceeding 100,000", () => {
    expect(() => validateUsageCount(100001, "numUses")).toThrow("exceeds maximum")
  })

  it("should include the field name in error messages", () => {
    expect(() => validateUsageCount(-1, "customField")).toThrow("customField")
    expect(() => validateUsageCount(100001, "customField")).toThrow("customField")
  })
})

// -------------------------------------------------------------------
// validateNameConnectionTime
// -------------------------------------------------------------------
describe("validateNameConnectionTime", () => {
  it("should accept valid connection times", () => {
    expect(validateNameConnectionTime(0)).toBe(true)
    expect(validateNameConnectionTime(3600)).toBe(true) // 1 hour
    expect(validateNameConnectionTime(86400)).toBe(true) // 1 day
  })

  it("should accept exactly 365 days worth of seconds", () => {
    const exactly365Days = 365 * 24 * 60 * 60
    expect(validateNameConnectionTime(exactly365Days)).toBe(true)
  })

  it("should throw for negative values", () => {
    expect(() => validateNameConnectionTime(-1)).toThrow("non-negative integer")
  })

  it("should throw for non-integer values", () => {
    expect(() => validateNameConnectionTime(1.5)).toThrow("non-negative integer")
    expect(() => validateNameConnectionTime(NaN)).toThrow("non-negative integer")
  })

  it("should throw for values exceeding 365 days", () => {
    const tooLong = 365 * 24 * 60 * 60 + 1
    expect(() => validateNameConnectionTime(tooLong)).toThrow("exceeds maximum")
  })
})

// -------------------------------------------------------------------
// validateNameStatValue
// -------------------------------------------------------------------
describe("validateNameStatValue", () => {
  it("should accept valid non-negative integers", () => {
    expect(validateNameStatValue(0, "kills")).toBe(true)
    expect(validateNameStatValue(500, "kills")).toBe(true)
    expect(validateNameStatValue(1000000, "kills")).toBe(true) // exact max
  })

  it("should throw for negative values", () => {
    expect(() => validateNameStatValue(-1, "kills")).toThrow("non-negative integer")
  })

  it("should throw for non-integer values", () => {
    expect(() => validateNameStatValue(1.5, "kills")).toThrow("non-negative integer")
    expect(() => validateNameStatValue(NaN, "kills")).toThrow("non-negative integer")
  })

  it("should throw for values exceeding 1,000,000", () => {
    expect(() => validateNameStatValue(1000001, "kills")).toThrow("exceeds maximum")
  })

  it("should include field name in error messages", () => {
    expect(() => validateNameStatValue(-1, "deaths")).toThrow("deaths")
    expect(() => validateNameStatValue(1000001, "suicides")).toThrow("suicides")
  })
})

// -------------------------------------------------------------------
// validateNameShotStats
// -------------------------------------------------------------------
describe("validateNameShotStats", () => {
  it("should accept valid non-negative integers", () => {
    expect(validateNameShotStats(0, "shots")).toBe(true)
    expect(validateNameShotStats(5000, "shots")).toBe(true)
    expect(validateNameShotStats(10000000, "shots")).toBe(true) // exact max
  })

  it("should throw for negative values", () => {
    expect(() => validateNameShotStats(-1, "shots")).toThrow("non-negative integer")
  })

  it("should throw for non-integer values", () => {
    expect(() => validateNameShotStats(1.5, "shots")).toThrow("non-negative integer")
    expect(() => validateNameShotStats(NaN, "shots")).toThrow("non-negative integer")
  })

  it("should throw for values exceeding 10,000,000", () => {
    expect(() => validateNameShotStats(10000001, "shots")).toThrow("exceeds maximum")
  })

  it("should include field name in error messages", () => {
    expect(() => validateNameShotStats(-1, "hits")).toThrow("hits")
    expect(() => validateNameShotStats(10000001, "hits")).toThrow("hits")
  })
})

// -------------------------------------------------------------------
// validatePlayerNameStatsUpdate
// -------------------------------------------------------------------
describe("validatePlayerNameStatsUpdate", () => {
  it("should accept an empty update object", () => {
    expect(validatePlayerNameStatsUpdate({})).toBe(true)
  })

  it("should validate numUses when provided", () => {
    expect(validatePlayerNameStatsUpdate({ numUses: 5 })).toBe(true)
    expect(() => validatePlayerNameStatsUpdate({ numUses: -1 })).toThrow()
    expect(() => validatePlayerNameStatsUpdate({ numUses: 100001 })).toThrow()
  })

  it("should validate connectionTime when provided", () => {
    expect(validatePlayerNameStatsUpdate({ connectionTime: 3600 })).toBe(true)
    expect(() => validatePlayerNameStatsUpdate({ connectionTime: -1 })).toThrow()
  })

  it("should validate kills when provided", () => {
    expect(validatePlayerNameStatsUpdate({ kills: 10 })).toBe(true)
    expect(() => validatePlayerNameStatsUpdate({ kills: -1 })).toThrow()
    expect(() => validatePlayerNameStatsUpdate({ kills: 1000001 })).toThrow()
  })

  it("should validate deaths when provided", () => {
    expect(validatePlayerNameStatsUpdate({ deaths: 5 })).toBe(true)
    expect(() => validatePlayerNameStatsUpdate({ deaths: -1 })).toThrow()
  })

  it("should validate suicides when provided", () => {
    expect(validatePlayerNameStatsUpdate({ suicides: 1 })).toBe(true)
    expect(() => validatePlayerNameStatsUpdate({ suicides: -1 })).toThrow()
  })

  it("should validate headshots when provided", () => {
    expect(validatePlayerNameStatsUpdate({ headshots: 3 })).toBe(true)
    expect(() => validatePlayerNameStatsUpdate({ headshots: -1 })).toThrow()
  })

  it("should validate shots when provided", () => {
    expect(validatePlayerNameStatsUpdate({ shots: 100 })).toBe(true)
    expect(() => validatePlayerNameStatsUpdate({ shots: -1 })).toThrow()
    expect(() => validatePlayerNameStatsUpdate({ shots: 10000001 })).toThrow()
  })

  it("should validate hits when provided", () => {
    expect(validatePlayerNameStatsUpdate({ hits: 50 })).toBe(true)
    expect(() => validatePlayerNameStatsUpdate({ hits: -1 })).toThrow()
    expect(() => validatePlayerNameStatsUpdate({ hits: 10000001 })).toThrow()
  })

  it("should validate lastUse when provided as a Date", () => {
    expect(validatePlayerNameStatsUpdate({ lastUse: new Date() })).toBe(true)
  })

  it("should throw when lastUse is not a Date", () => {
    expect(() => validatePlayerNameStatsUpdate({ lastUse: "not-a-date" as any })).toThrow(
      "must be a Date",
    )
    expect(() => validatePlayerNameStatsUpdate({ lastUse: 12345 as any })).toThrow("must be a Date")
  })

  it("should skip validation for undefined fields", () => {
    expect(
      validatePlayerNameStatsUpdate({
        numUses: undefined,
        connectionTime: undefined,
        kills: undefined,
        deaths: undefined,
        suicides: undefined,
        headshots: undefined,
        shots: undefined,
        hits: undefined,
        lastUse: undefined,
      }),
    ).toBe(true)
  })

  it("should validate a fully populated update object", () => {
    expect(
      validatePlayerNameStatsUpdate({
        numUses: 10,
        connectionTime: 3600,
        kills: 5,
        deaths: 3,
        suicides: 1,
        headshots: 2,
        shots: 100,
        hits: 50,
        lastUse: new Date(),
      }),
    ).toBe(true)
  })
})

// -------------------------------------------------------------------
// sanitizePlayerNameStatsUpdate
// -------------------------------------------------------------------
describe("sanitizePlayerNameStatsUpdate", () => {
  it("should return empty object for empty input", () => {
    const result = sanitizePlayerNameStatsUpdate({})
    expect(result).toEqual({})
  })

  it("should floor numeric values", () => {
    const result = sanitizePlayerNameStatsUpdate({
      numUses: 5.9,
      kills: 3.1,
      deaths: 2.7,
    })
    expect(result.numUses).toBe(5)
    expect(result.kills).toBe(3)
    expect(result.deaths).toBe(2)
  })

  it("should drop NaN values", () => {
    const result = sanitizePlayerNameStatsUpdate({
      numUses: NaN,
      kills: 5,
    })
    expect(result.numUses).toBeUndefined()
    expect(result.kills).toBe(5)
  })

  it("should drop negative values", () => {
    const result = sanitizePlayerNameStatsUpdate({
      kills: -5,
      deaths: 3,
    })
    expect(result.kills).toBeUndefined()
    expect(result.deaths).toBe(3)
  })

  it("should preserve Date instances for lastUse", () => {
    const date = new Date("2024-01-15T00:00:00Z")
    const result = sanitizePlayerNameStatsUpdate({ lastUse: date })
    expect(result.lastUse).toBe(date)
  })

  it("should create new Date when lastUse is not a Date instance", () => {
    const result = sanitizePlayerNameStatsUpdate({ lastUse: "not-a-date" as any })
    expect(result.lastUse).toBeInstanceOf(Date)
  })

  it("should skip undefined fields", () => {
    const result = sanitizePlayerNameStatsUpdate({
      numUses: undefined,
      kills: undefined,
      lastUse: undefined,
    })
    expect(result.numUses).toBeUndefined()
    expect(result.kills).toBeUndefined()
    expect(result.lastUse).toBeUndefined()
  })

  it("should sanitize all numeric fields correctly", () => {
    const result = sanitizePlayerNameStatsUpdate({
      numUses: 10,
      connectionTime: 3600,
      kills: 5,
      deaths: 3,
      suicides: 1,
      shots: 100,
      hits: 50,
      headshots: 2,
    })

    expect(result.numUses).toBe(10)
    expect(result.connectionTime).toBe(3600)
    expect(result.kills).toBe(5)
    expect(result.deaths).toBe(3)
    expect(result.suicides).toBe(1)
    expect(result.shots).toBe(100)
    expect(result.hits).toBe(50)
    expect(result.headshots).toBe(2)
  })

  it("should handle zero values as valid", () => {
    const result = sanitizePlayerNameStatsUpdate({
      numUses: 0,
      kills: 0,
    })
    expect(result.numUses).toBe(0)
    expect(result.kills).toBe(0)
  })

  it("should convert string-like numeric values via Number()", () => {
    const result = sanitizePlayerNameStatsUpdate({
      kills: "7" as any,
      deaths: "3.9" as any,
    })
    expect(result.kills).toBe(7)
    expect(result.deaths).toBe(3)
  })
})

// -------------------------------------------------------------------
// sanitizePlayerName
// -------------------------------------------------------------------
describe("sanitizePlayerName", () => {
  it("should return empty string for non-string input", () => {
    expect(sanitizePlayerName(null as any)).toBe("")
    expect(sanitizePlayerName(undefined as any)).toBe("")
    expect(sanitizePlayerName("")).toBe("")
    expect(sanitizePlayerName(123 as any)).toBe("")
  })

  it("should trim whitespace", () => {
    expect(sanitizePlayerName("  Player  ")).toBe("Player")
  })

  it("should remove control characters", () => {
    expect(sanitizePlayerName("Play\x00er")).toBe("Player")
    expect(sanitizePlayerName("Play\x1fer")).toBe("Player")
    expect(sanitizePlayerName("Play\x7fer")).toBe("Player")
  })

  it("should truncate to 64 characters", () => {
    const longName = "A".repeat(100)
    const result = sanitizePlayerName(longName)
    expect(result.length).toBe(64)
  })

  it("should handle normal names without modification", () => {
    expect(sanitizePlayerName("TestPlayer")).toBe("TestPlayer")
  })

  it("should trim before removing control chars and truncating", () => {
    const result = sanitizePlayerName("  Valid  ")
    expect(result).toBe("Valid")
  })
})
