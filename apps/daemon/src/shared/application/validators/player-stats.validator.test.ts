/**
 * Player Stats Validator Tests
 *
 * Tests for player statistics validation utilities.
 */

import { describe, expect, it } from "vitest"
import {
  sanitizePlayerStatsUpdate,
  validateConnectionTime,
  validatePlayerName,
  validatePlayerStatsUpdate,
  validateSkillChange,
  validateStatValue,
  validateStreakValue,
} from "./player-stats.validator"

describe("validateStatValue", () => {
  it("should accept valid integer values", () => {
    expect(validateStatValue(0, "kills")).toBe(true)
    expect(validateStatValue(100, "kills")).toBe(true)
    expect(validateStatValue(-50, "kills")).toBe(true)
    expect(validateStatValue(10000, "kills")).toBe(true)
    expect(validateStatValue(-1000, "kills")).toBe(true)
  })

  it("should reject non-integer values", () => {
    expect(() => validateStatValue(1.5, "kills")).toThrow("must be an integer")
    expect(() => validateStatValue(NaN, "kills")).toThrow("must be an integer")
  })

  it("should reject values outside acceptable range", () => {
    expect(() => validateStatValue(10001, "kills")).toThrow("outside acceptable range")
    expect(() => validateStatValue(-1001, "kills")).toThrow("outside acceptable range")
  })
})

describe("validateSkillChange", () => {
  it("should accept valid skill changes", () => {
    expect(validateSkillChange(0)).toBe(true)
    expect(validateSkillChange(50)).toBe(true)
    expect(validateSkillChange(-50)).toBe(true)
    expect(validateSkillChange(100)).toBe(true)
    expect(validateSkillChange(-100)).toBe(true)
  })

  it("should reject non-integer values", () => {
    expect(() => validateSkillChange(1.5)).toThrow("must be an integer")
  })

  it("should reject extreme skill changes", () => {
    expect(() => validateSkillChange(101)).toThrow("too extreme")
    expect(() => validateSkillChange(-101)).toThrow("too extreme")
  })
})

describe("validateStreakValue", () => {
  it("should accept valid streak values", () => {
    expect(validateStreakValue(0, "killStreak")).toBe(true)
    expect(validateStreakValue(10, "killStreak")).toBe(true)
    expect(validateStreakValue(500, "killStreak")).toBe(true)
  })

  it("should reject negative values", () => {
    expect(() => validateStreakValue(-1, "killStreak")).toThrow("non-negative integer")
  })

  it("should reject non-integer values", () => {
    expect(() => validateStreakValue(1.5, "killStreak")).toThrow("non-negative integer")
  })

  it("should reject values exceeding maximum", () => {
    expect(() => validateStreakValue(501, "killStreak")).toThrow("exceeds maximum")
  })
})

describe("validateConnectionTime", () => {
  it("should accept valid connection times", () => {
    expect(validateConnectionTime(0)).toBe(true)
    expect(validateConnectionTime(3600)).toBe(true) // 1 hour
    expect(validateConnectionTime(86400)).toBe(true) // 1 day
  })

  it("should reject negative values", () => {
    expect(() => validateConnectionTime(-1)).toThrow("non-negative integer")
  })

  it("should reject non-integer values", () => {
    expect(() => validateConnectionTime(1.5)).toThrow("non-negative integer")
  })

  it("should reject values exceeding 30 days", () => {
    const thirtyOneDays = 31 * 24 * 60 * 60
    expect(() => validateConnectionTime(thirtyOneDays)).toThrow("exceeds maximum")
  })
})

describe("validatePlayerName", () => {
  it("should accept valid player names", () => {
    expect(validatePlayerName("Player")).toBe(true)
    expect(validatePlayerName("Player123")).toBe(true)
    expect(validatePlayerName("Player_Name")).toBe(true)
    expect(validatePlayerName("A")).toBe(true) // Minimum length
  })

  it("should reject empty names", () => {
    expect(() => validatePlayerName("")).toThrow("non-empty string")
  })

  it("should reject non-string values", () => {
    expect(() => validatePlayerName(null as any)).toThrow("non-empty string")
    expect(() => validatePlayerName(undefined as any)).toThrow("non-empty string")
  })

  it("should reject names that are too long", () => {
    const longName = "A".repeat(65)
    expect(() => validatePlayerName(longName)).toThrow("between 1 and 64")
  })

  it("should reject names with control characters", () => {
    expect(() => validatePlayerName("Player\x00")).toThrow("control characters")
    expect(() => validatePlayerName("Player\x1f")).toThrow("control characters")
    expect(() => validatePlayerName("Player\x7f")).toThrow("control characters")
  })
})

describe("validatePlayerStatsUpdate", () => {
  it("should validate empty updates", () => {
    expect(validatePlayerStatsUpdate({})).toBe(true)
  })

  it("should validate valid stat updates", () => {
    expect(
      validatePlayerStatsUpdate({
        kills: 10,
        deaths: 5,
        suicides: 1,
        teamkills: 0,
        headshots: 3,
        shots: 100,
        hits: 50,
      }),
    ).toBe(true)
  })

  it("should validate skill changes", () => {
    expect(validatePlayerStatsUpdate({ skill: 10 })).toBe(true)
    expect(validatePlayerStatsUpdate({ skill: -10 })).toBe(true)
  })

  it("should validate streak values", () => {
    expect(validatePlayerStatsUpdate({ killStreak: 5, deathStreak: 0 })).toBe(true)
  })

  it("should validate connection time", () => {
    expect(validatePlayerStatsUpdate({ connectionTime: 3600 })).toBe(true)
  })

  it("should validate player name", () => {
    expect(validatePlayerStatsUpdate({ lastName: "ValidName" })).toBe(true)
  })

  it("should validate lastEvent date", () => {
    expect(validatePlayerStatsUpdate({ lastEvent: new Date() })).toBe(true)
  })

  it("should reject invalid lastEvent", () => {
    expect(() => validatePlayerStatsUpdate({ lastEvent: "not a date" as any })).toThrow(
      "must be a Date",
    )
  })

  it("should reject invalid stat values in update", () => {
    expect(() => validatePlayerStatsUpdate({ kills: 1.5 })).toThrow()
    expect(() => validatePlayerStatsUpdate({ skill: 200 })).toThrow()
    expect(() => validatePlayerStatsUpdate({ killStreak: -1 })).toThrow()
  })
})

describe("sanitizePlayerStatsUpdate", () => {
  it("should sanitize numeric fields", () => {
    const result = sanitizePlayerStatsUpdate({
      kills: 10.7,
      deaths: 5.2,
    })

    expect(result.kills).toBe(10)
    expect(result.deaths).toBe(5)
  })

  it("should handle NaN values", () => {
    const result = sanitizePlayerStatsUpdate({
      kills: NaN,
      deaths: 5,
    })

    expect(result.kills).toBeUndefined()
    expect(result.deaths).toBe(5)
  })

  it("should trim player names", () => {
    const result = sanitizePlayerStatsUpdate({
      lastName: "  Player  ",
    })

    expect(result.lastName).toBe("Player")
  })

  it("should preserve Date objects", () => {
    const date = new Date()
    const result = sanitizePlayerStatsUpdate({
      lastEvent: date,
    })

    expect(result.lastEvent).toBe(date)
  })

  it("should create new Date for non-Date lastEvent", () => {
    const result = sanitizePlayerStatsUpdate({
      lastEvent: "not a date" as any,
    })

    expect(result.lastEvent).toBeInstanceOf(Date)
  })

  it("should ignore undefined fields", () => {
    const result = sanitizePlayerStatsUpdate({
      kills: undefined,
      lastName: undefined,
    })

    expect(result.kills).toBeUndefined()
    expect(result.lastName).toBeUndefined()
  })

  it("should ignore non-string lastName", () => {
    const result = sanitizePlayerStatsUpdate({
      lastName: 123 as any,
    })

    expect(result.lastName).toBeUndefined()
  })

  it("should sanitize all numeric fields", () => {
    const result = sanitizePlayerStatsUpdate({
      kills: 1,
      deaths: 2,
      suicides: 3,
      teamkills: 4,
      headshots: 5,
      shots: 6,
      hits: 7,
      skill: 8,
      killStreak: 9,
      deathStreak: 10,
      connectionTime: 11,
    })

    expect(result.kills).toBe(1)
    expect(result.deaths).toBe(2)
    expect(result.suicides).toBe(3)
    expect(result.teamkills).toBe(4)
    expect(result.headshots).toBe(5)
    expect(result.shots).toBe(6)
    expect(result.hits).toBe(7)
    expect(result.skill).toBe(8)
    expect(result.killStreak).toBe(9)
    expect(result.deathStreak).toBe(10)
    expect(result.connectionTime).toBe(11)
  })
})
