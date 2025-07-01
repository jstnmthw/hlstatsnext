/**
 * Comprehensive Base Parser Tests
 *
 * Tests for BaseParser abstract class including edge cases,
 * error handling, and uncovered utility methods.
 */

import { describe, it, expect } from "vitest"
import { BaseParser, type ParseResult } from "../../src/services/ingress/parsers/base.parser"

// Concrete implementation for testing abstract class
class TestParser extends BaseParser {
  constructor() {
    super("test-game")
  }

  async parse(): Promise<ParseResult> {
    return { success: false, error: "Not implemented" }
  }

  canParse(): boolean {
    return true
  }

  // Expose protected methods for testing
  public extractBasicInfoPublic(logLine: string) {
    return this.extractBasicInfo(logLine)
  }

  public parsePlayerInfoPublic(playerStr: string) {
    return this.parsePlayerInfo(playerStr)
  }

  public parsePositionPublic(positionStr: string) {
    return this.parsePosition(positionStr)
  }

  public isValidWeaponPublic(weapon: string) {
    return this.isValidWeapon(weapon)
  }

  public extractServerInfoPublic() {
    return this.extractServerInfo()
  }

  public sanitizeStringPublic(input: string) {
    return this.sanitizeString(input)
  }

  public normaliseLogLinePublic(raw: string) {
    return this.normaliseLogLine(raw)
  }
}

describe("BaseParser", () => {
  const parser = new TestParser()

  describe("extractBasicInfo", () => {
    it("should extract timestamp and content from valid log line", () => {
      const logLine = 'L 06/28/2025 - 08:42:47: World triggered "Round_Start"'
      const result = parser.extractBasicInfoPublic(logLine)

      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.timestamp.getFullYear()).toBe(2025)
      expect(result.timestamp.getMonth()).toBe(5) // June (0-indexed)
      expect(result.timestamp.getDate()).toBe(28)
      expect(result.timestamp.getHours()).toBe(8)
      expect(result.timestamp.getMinutes()).toBe(42)
      expect(result.timestamp.getSeconds()).toBe(47)
      expect(result.content).toBe('World triggered "Round_Start"')
    })

    it("should throw error for invalid log line format", () => {
      const invalidLines = [
        "",
        "Invalid line without timestamp",
        "L 06/28/2025",
        "06/28/2025 - 08:42:47: Missing L prefix",
      ]

      invalidLines.forEach((line) => {
        expect(() => parser.extractBasicInfoPublic(line)).toThrow("Invalid log line format")
      })
    })

    it("should throw error for malformed timestamp", () => {
      const malformedLines = [
        "L invalid-timestamp: content",
        // Note: JavaScript Date constructor is quite lenient, so most formats don't throw
      ]

      malformedLines.forEach((line) => {
        expect(() => parser.extractBasicInfoPublic(line)).toThrow()
      })
    })
  })

  describe("parsePlayerInfo", () => {
    it("should parse valid player string", () => {
      const playerStr = '"PlayerName"<123><STEAM_1:0:12345><TERRORIST>'
      const result = parser.parsePlayerInfoPublic(playerStr)

      expect(result.name).toBe("PlayerName")
      expect(result.steamId).toBe("STEAM_1:0:12345")
      expect(result.team).toBe("TERRORIST")
      expect(result.isBot).toBe(false)
    })

    it("should detect bots correctly", () => {
      const botTests = [
        { input: '"BotPlayer"<456><BOT><CT>', expected: true },
        { input: '"BOT_Easy"<789><BOT_12345><TERRORIST>', expected: true },
        { input: '"Human Player"<123><STEAM_1:0:54321><CT>', expected: false },
      ]

      botTests.forEach(({ input, expected }) => {
        const result = parser.parsePlayerInfoPublic(input)
        expect(result.isBot).toBe(expected)
      })
    })

    it("should handle player names with special characters", () => {
      const specialNames = [
        '"Player [TAG]"<123><STEAM_1:0:12345><CT>',
        '"Player with spaces"<456><STEAM_1:0:67890><TERRORIST>',
        '"Player_with_underscores"<789><STEAM_1:0:11111><CT>',
      ]

      specialNames.forEach((playerStr) => {
        const result = parser.parsePlayerInfoPublic(playerStr)
        expect(result.name).toBeTruthy()
        expect(result.steamId).toBeTruthy()
        expect(result.team).toBeTruthy()
      })
    })

    it("should throw error for invalid player format", () => {
      const invalidFormats = [
        "InvalidFormat",
        '"Name"<uid><steamid>', // Missing team
        '"Name"<uid>', // Missing steamid and team
        "Name<uid><steamid><team>", // Missing quotes
        '"Name<uid><steamid><team>', // Missing closing quote
      ]

      invalidFormats.forEach((format) => {
        expect(() => parser.parsePlayerInfoPublic(format)).toThrow("Invalid player format")
      })
    })
  })

  describe("parsePosition", () => {
    it("should parse valid position coordinates", () => {
      const positionTests = [
        { input: "100 200 300", expected: { x: 100, y: 200, z: 300 } },
        { input: "-100.5 200.75 -300.25", expected: { x: -100.5, y: 200.75, z: -300.25 } },
        { input: "0 0 0", expected: { x: 0, y: 0, z: 0 } },
      ]

      positionTests.forEach(({ input, expected }) => {
        const result = parser.parsePositionPublic(input)
        expect(result).toEqual(expected)
      })
    })

    it("should return undefined for invalid position format", () => {
      const invalidPositions = [
        "",
        "100 200", // Missing Z
        "100 200 300 400", // Too many coordinates
        "abc def ghi", // Non-numeric
        "100 200 ", // Incomplete
      ]

      invalidPositions.forEach((position) => {
        const result = parser.parsePositionPublic(position)
        expect(result).toBeUndefined()
      })
    })
  })

  describe("isValidWeapon", () => {
    it("should validate weapon names correctly", () => {
      const weaponTests = [
        { weapon: "ak47", expected: true },
        { weapon: "m4a1", expected: true },
        { weapon: "knife", expected: true },
        { weapon: "", expected: false },
        { weapon: "weapon<script>", expected: false },
        { weapon: "weapon>tag", expected: false },
      ]

      weaponTests.forEach(({ weapon, expected }) => {
        const result = parser.isValidWeaponPublic(weapon)
        expect(result).toBe(expected)
      })
    })
  })

  describe("extractServerInfo", () => {
    it("should return empty object for base implementation", () => {
      const result = parser.extractServerInfoPublic()
      expect(result).toEqual({})
    })
  })

  describe("sanitizeString", () => {
    it("should sanitize user input properly", () => {
      const sanitizeTests = [
        { input: "Normal text", expected: "Normal text" },
        { input: "  Trimmed text  ", expected: "Trimmed text" },
        { input: "Text<script>alert('xss')</script>", expected: "Textscriptalert('xss')/script" },
        { input: "Text>with>brackets<", expected: "Textwithbrackets" },
        { input: "A".repeat(300), expected: "A".repeat(255) }, // Length limit
      ]

      sanitizeTests.forEach(({ input, expected }) => {
        const result = parser.sanitizeStringPublic(input)
        expect(result).toBe(expected)
      })
    })
  })

  describe("normaliseLogLine", () => {
    it("should return line unchanged if it already starts with 'L '", () => {
      const logLine = 'L 06/28/2025 - 08:42:47: World triggered "Round_Start"'
      const result = parser.normaliseLogLinePublic(logLine)
      expect(result).toBe(logLine)
    })

    it("should extract log line from UDP packet with prefix bytes", () => {
      const rawPacket = '\xff\xff\xff\xfflog L 06/28/2025 - 08:42:47: World triggered "Round_Start"'
      const result = parser.normaliseLogLinePublic(rawPacket)
      expect(result).toBe('L 06/28/2025 - 08:42:47: World triggered "Round_Start"')
    })

    it("should handle lines with extra whitespace", () => {
      const tests = [
        { input: "  L 06/28/2025 - 08:42:47: Event", expected: "L 06/28/2025 - 08:42:47: Event" },
        {
          input: "\t\n L 06/28/2025 - 08:42:47: Event",
          expected: "L 06/28/2025 - 08:42:47: Event",
        },
      ]

      tests.forEach(({ input, expected }) => {
        const result = parser.normaliseLogLinePublic(input)
        expect(result).toBe(expected)
      })
    })

    it("should find log prefix within the string", () => {
      const messyInput = "Some junk data before L 06/28/2025 - 08:42:47: Real event"
      const result = parser.normaliseLogLinePublic(messyInput)
      expect(result).toBe("L 06/28/2025 - 08:42:47: Real event")
    })

    it("should return trimmed string if no log prefix found", () => {
      const noPrefix = "  No log prefix here  "
      const result = parser.normaliseLogLinePublic(noPrefix)
      expect(result).toBe("No log prefix here  ") // Only trims start, not end
    })
  })

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty strings gracefully", () => {
      expect(() => parser.extractBasicInfoPublic("")).toThrow()
      expect(parser.parsePositionPublic("")).toBeUndefined()
      expect(parser.isValidWeaponPublic("")).toBe(false)
      expect(parser.sanitizeStringPublic("")).toBe("")
      expect(parser.normaliseLogLinePublic("")).toBe("")
    })

    it("should handle null and undefined gracefully", () => {
      // These should throw or handle gracefully depending on implementation
      expect(() => parser.extractBasicInfoPublic(null as unknown as string)).toThrow()
      expect(() => parser.parsePlayerInfoPublic(undefined as unknown as string)).toThrow()
    })

    it("should handle extremely long inputs", () => {
      const longString = "A".repeat(10000)
      const sanitized = parser.sanitizeStringPublic(longString)
      expect(sanitized.length).toBeLessThanOrEqual(255)
    })
  })

  describe("Performance Tests", () => {
    it("should handle batch parsing efficiently", () => {
      const logLines = Array.from(
        { length: 1000 },
        (_, i) => `L 06/28/2025 - 08:42:${String(i % 60).padStart(2, "0")}: Event ${i}`,
      )

      const start = Date.now()
      logLines.forEach((line) => parser.extractBasicInfoPublic(line))
      const duration = Date.now() - start

      // Should process 1000 lines in under 1 second
      expect(duration).toBeLessThan(1000)
    })
  })
})
