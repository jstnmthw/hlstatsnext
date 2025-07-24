/**
 * BaseParser Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { BaseParser } from "./base.parser"
import type { ParseResult } from "./base.parser"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"

// Helper type for accessing protected methods
type ParserWithMethods = {
  game: string
  createTimestamp: (dateStr?: string) => Date
  extractQuotedValue: (text: string, key: string) => string | null
  extractNumericValue: (text: string, key: string) => number | null
}

// Concrete implementation for testing
class TestParser extends BaseParser {
  constructor(game: string) {
    super(game)
  }

  parseLine(logLine: string, serverId: number): ParseResult {
    // Simple test implementation that parses basic log lines
    if (logLine.includes("test_event")) {
      const event: BaseEvent = {
        timestamp: this.createTimestamp(),
        serverId,
        eventType: EventType.PLAYER_CONNECT,
        data: {},
      }
      return { event, success: true }
    }

    if (logLine.includes("error")) {
      return { event: null, success: false, error: "Parse error" }
    }

    return { event: null, success: false, error: "Unknown log format" }
  }
}

describe("BaseParser", () => {
  let parser: TestParser

  beforeEach(() => {
    parser = new TestParser("csgo")
  })

  describe("Parser instantiation", () => {
    it("should create parser instance with game", () => {
      expect(parser).toBeDefined()
      expect(parser).toBeInstanceOf(BaseParser)
      expect((parser as unknown as ParserWithMethods).game).toBe("csgo")
    })

    it("should be an abstract class requiring implementation", () => {
      expect(parser.parseLine).toBeDefined()
      expect(typeof parser.parseLine).toBe("function")
    })
  })

  describe("createTimestamp", () => {
    it("should create current timestamp when no date string provided", () => {
      const before = new Date()
      const timestamp = (parser as unknown as ParserWithMethods).createTimestamp()
      const after = new Date()

      expect(timestamp).toBeInstanceOf(Date)
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it("should create current timestamp when undefined provided", () => {
      const before = new Date()
      const timestamp = (parser as unknown as ParserWithMethods).createTimestamp(undefined)
      const after = new Date()

      expect(timestamp).toBeInstanceOf(Date)
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it("should parse valid date strings", () => {
      const dateStr = "2023-01-15T10:30:45.123Z"
      const timestamp = (parser as unknown as ParserWithMethods).createTimestamp(dateStr)

      expect(timestamp).toBeInstanceOf(Date)
      expect(timestamp.toISOString()).toBe(dateStr)
    })

    it("should parse partial date strings", () => {
      const dateStr = "2023-01-15"
      const timestamp = (parser as unknown as ParserWithMethods).createTimestamp(dateStr)

      expect(timestamp).toBeInstanceOf(Date)
      expect(timestamp.getFullYear()).toBe(2023)
      expect(timestamp.getMonth()).toBe(0) // January is 0
      expect(timestamp.getDate()).toBe(15)
    })

    it("should fallback to current time for invalid date strings", () => {
      const invalidDates = [
        "invalid-date",
        "2023-13-45", // Invalid month/day
        "not-a-date",
        "2023/01/15", // Different format
        "",
      ]

      for (const dateStr of invalidDates) {
        const before = new Date()
        const timestamp = (parser as unknown as ParserWithMethods).createTimestamp(dateStr)
        const after = new Date()

        expect(timestamp).toBeInstanceOf(Date)
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
        expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
      }
    })

    it("should handle edge cases in date parsing", () => {
      const edgeCases = [
        "1970-01-01T00:00:00.000Z", // Unix epoch
        "2038-01-19T03:14:07.000Z", // Unix timestamp limit (32-bit)
        "2023-12-31T23:59:59.999Z", // End of year
      ]

      for (const dateStr of edgeCases) {
        const timestamp = (parser as unknown as ParserWithMethods).createTimestamp(dateStr)
        expect(timestamp).toBeInstanceOf(Date)
        expect(timestamp.toISOString()).toBe(dateStr)
      }
    })
  })

  describe("extractQuotedValue", () => {
    it("should extract simple quoted values", () => {
      const text = 'player_name"TestPlayer"'
      const result = (parser as unknown as ParserWithMethods).extractQuotedValue(
        text,
        "player_name",
      )

      expect(result).toBe("TestPlayer")
    })

    it("should extract quoted values with spaces", () => {
      const text = 'player_name"Test Player With Spaces"'
      const result = (parser as unknown as ParserWithMethods).extractQuotedValue(
        text,
        "player_name",
      )

      expect(result).toBe("Test Player With Spaces")
    })

    it("should extract quoted values with special characters", () => {
      const text = 'weapon"ak47|special_variant"'
      const result = (parser as unknown as ParserWithMethods).extractQuotedValue(text, "weapon")

      expect(result).toBe("ak47|special_variant")
    })

    it("should return null for missing keys", () => {
      const text = 'player_name"TestPlayer"'
      const result = (parser as unknown as ParserWithMethods).extractQuotedValue(
        text,
        "missing_key",
      )

      expect(result).toBeNull()
    })

    it("should return null for empty quoted values", () => {
      const text = 'player_name""'
      const result = (parser as unknown as ParserWithMethods).extractQuotedValue(
        text,
        "player_name",
      )

      expect(result).toBeNull()
    })

    it("should handle multiple quoted values and extract the correct one", () => {
      const text = 'player_name"Player1" target_name"Player2" weapon"ak47"'

      expect((parser as unknown as ParserWithMethods).extractQuotedValue(text, "player_name")).toBe(
        "Player1",
      )
      expect((parser as unknown as ParserWithMethods).extractQuotedValue(text, "target_name")).toBe(
        "Player2",
      )
      expect((parser as unknown as ParserWithMethods).extractQuotedValue(text, "weapon")).toBe(
        "ak47",
      )
    })

    it("should handle nested quotes within values", () => {
      const text = 'message"Player said: \\"Hello World\\""'
      const result = (parser as unknown as ParserWithMethods).extractQuotedValue(text, "message")

      expect(result).toBe('Player said: \\"Hello World\\"')
    })

    it("should handle Unicode characters", () => {
      const text = 'player_name"Tëst_Plâyér_🎮"'
      const result = (parser as unknown as ParserWithMethods).extractQuotedValue(
        text,
        "player_name",
      )

      expect(result).toBe("Tëst_Plâyér_🎮")
    })

    it("should be case sensitive for keys", () => {
      const text = 'Player_Name"TestPlayer"'

      expect((parser as unknown as ParserWithMethods).extractQuotedValue(text, "Player_Name")).toBe(
        "TestPlayer",
      )
      expect(
        (parser as unknown as ParserWithMethods).extractQuotedValue(text, "player_name"),
      ).toBeNull()
      expect(
        (parser as unknown as ParserWithMethods).extractQuotedValue(text, "PLAYER_NAME"),
      ).toBeNull()
    })
  })

  describe("extractNumericValue", () => {
    it("should extract integer values", () => {
      const text = 'damage"100"'
      const result = (parser as unknown as ParserWithMethods).extractNumericValue(text, "damage")

      expect(result).toBe(100)
    })

    it("should extract floating point values", () => {
      const text = 'health"75.5"'
      const result = (parser as unknown as ParserWithMethods).extractNumericValue(text, "health")

      expect(result).toBe(75.5)
    })

    it("should extract negative values", () => {
      const text = 'temperature"-15.2"'
      const result = (parser as unknown as ParserWithMethods).extractNumericValue(
        text,
        "temperature",
      )

      expect(result).toBe(-15.2)
    })

    it("should extract zero values", () => {
      const text = 'kills"0"'
      const result = (parser as unknown as ParserWithMethods).extractNumericValue(text, "kills")

      expect(result).toBe(0)
    })

    it("should return null for non-numeric values", () => {
      const text = 'player_name"TestPlayer"'
      const result = (parser as unknown as ParserWithMethods).extractNumericValue(
        text,
        "player_name",
      )

      expect(result).toBeNull()
    })

    it("should return null for missing keys", () => {
      const text = 'damage"100"'
      const result = (parser as unknown as ParserWithMethods).extractNumericValue(
        text,
        "missing_key",
      )

      expect(result).toBeNull()
    })

    it("should return null for empty quoted values", () => {
      const text = 'damage""'
      const result = (parser as unknown as ParserWithMethods).extractNumericValue(text, "damage")

      expect(result).toBeNull()
    })

    it("should handle scientific notation", () => {
      const text = 'large_number"1.5e3"'
      const result = (parser as unknown as ParserWithMethods).extractNumericValue(
        text,
        "large_number",
      )

      expect(result).toBe(1500)
    })

    it("should handle multiple numeric values", () => {
      const text = 'x"100.5" y"200.75" z"-50.25"'

      expect((parser as unknown as ParserWithMethods).extractNumericValue(text, "x")).toBe(100.5)
      expect((parser as unknown as ParserWithMethods).extractNumericValue(text, "y")).toBe(200.75)
      expect((parser as unknown as ParserWithMethods).extractNumericValue(text, "z")).toBe(-50.25)
    })

    it("should handle very large numbers", () => {
      const text = 'big_number"999999999999"'
      const result = (parser as unknown as ParserWithMethods).extractNumericValue(
        text,
        "big_number",
      )

      expect(result).toBe(999999999999)
    })

    it("should handle very small decimal numbers", () => {
      const text = 'small_number"0.000001"'
      const result = (parser as unknown as ParserWithMethods).extractNumericValue(
        text,
        "small_number",
      )

      expect(result).toBe(0.000001)
    })
  })

  describe("parseLine implementation", () => {
    it("should parse valid test events", () => {
      const result = parser.parseLine("test_event occurred", 1)

      expect(result.success).toBe(true)
      expect(result.event).not.toBeNull()
      expect(result.event?.serverId).toBe(1)
      expect(result.event?.eventType).toBe(EventType.PLAYER_CONNECT)
    })

    it("should handle parse errors", () => {
      const result = parser.parseLine("error in parsing", 1)

      expect(result.success).toBe(false)
      expect(result.event).toBeNull()
      expect(result.error).toBe("Parse error")
    })

    it("should handle unknown log formats", () => {
      const result = parser.parseLine("unknown log format", 1)

      expect(result.success).toBe(false)
      expect(result.event).toBeNull()
      expect(result.error).toBe("Unknown log format")
    })

    it("should handle empty log lines", () => {
      const result = parser.parseLine("", 1)

      expect(result.success).toBe(false)
      expect(result.event).toBeNull()
      expect(result.error).toBe("Unknown log format")
    })
  })

  describe("Edge cases and error handling", () => {
    it("should handle malformed input gracefully", () => {
      const malformedInputs = [
        'player_name"unclosed_quote',
        'damage"not_a_number"',
        "key_without_quotes value",
        'multiple"quotes"in"value"',
        "\x00\x01\x02", // Control characters
      ]

      for (const input of malformedInputs) {
        expect(() =>
          (parser as unknown as ParserWithMethods).extractQuotedValue(input, "test"),
        ).not.toThrow()
        expect(() =>
          (parser as unknown as ParserWithMethods).extractNumericValue(input, "test"),
        ).not.toThrow()
      }
    })

    it("should handle very long input strings", () => {
      const longValue = "x".repeat(10000)
      const text = `player_name"${longValue}"`

      const result = (parser as unknown as ParserWithMethods).extractQuotedValue(
        text,
        "player_name",
      )
      expect(result).toBe(longValue)
    })

    it("should handle regex special characters in keys", () => {
      const text = 'key.with[special]chars"value"'
      const result = (parser as unknown as ParserWithMethods).extractQuotedValue(
        text,
        "key.with[special]chars",
      )

      expect(result).toBe("value")
    })

    it("should handle multiple parsers with different games", () => {
      const csgoParser = new TestParser("csgo")
      const tf2Parser = new TestParser("tf2")

      expect((csgoParser as unknown as ParserWithMethods).game).toBe("csgo")
      expect((tf2Parser as unknown as ParserWithMethods).game).toBe("tf2")
    })
  })
})
