/**
 * Color Formatter Tests
 *
 * Comprehensive tests for all color formatter implementations
 */

import { describe, it, expect, beforeEach } from "vitest"
import { PlainTextFormatter } from "./plain-text.formatter"
import { GoldSrcColorFormatter } from "./goldsrc-color.formatter"
import { SourceColorFormatter } from "./source-color.formatter"
import { ColorFormatterFactory } from "./color-formatter.factory"
import { DEFAULT_COLOR_SCHEME } from "./color-formatter.interface"
import type { IColorFormatter } from "./color-formatter.interface"

describe("PlainTextFormatter", () => {
  let formatter: IColorFormatter

  beforeEach(() => {
    formatter = new PlainTextFormatter()
  })

  it("should format text without any color codes", () => {
    expect(formatter.formatTag("[HLStatsNext]")).toBe("[HLStatsNext]")
    expect(formatter.formatPlayerName("TestPlayer")).toBe("TestPlayer")
    expect(formatter.formatPoints(25)).toBe("+25")
    expect(formatter.formatPoints(-10)).toBe("-10")
    expect(formatter.formatAction("Plant the Bomb")).toBe("Plant the Bomb")
    expect(formatter.formatRank(15)).toBe("#15")
  })

  it("should not support colors", () => {
    expect(formatter.supportsColors()).toBe(false)
  })

  it("should return the configured color scheme", () => {
    expect(formatter.getColorScheme()).toEqual(DEFAULT_COLOR_SCHEME)
  })

  it("should format player names with team but without colors", () => {
    expect(formatter.formatPlayerName("Player1", "CT")).toBe("Player1")
    expect(formatter.formatPlayerName("Player2", "TERRORIST")).toBe("Player2")
  })
})

describe("GoldSrcColorFormatter", () => {
  describe("without colors enabled", () => {
    let formatter: IColorFormatter

    beforeEach(() => {
      formatter = GoldSrcColorFormatter.withoutColors()
    })

    it("should format text without color codes when colors are disabled", () => {
      expect(formatter.formatTag("[HLStatsNext]")).toBe("[HLStatsNext]")
      expect(formatter.formatPlayerName("TestPlayer")).toBe("TestPlayer")
      expect(formatter.formatPoints(25)).toBe("+25")
      expect(formatter.formatAction("Plant the Bomb")).toBe("Plant the Bomb")
    })

    it("should not support colors when disabled", () => {
      expect(formatter.supportsColors()).toBe(false)
    })
  })

  describe("with colors enabled", () => {
    let formatter: IColorFormatter

    beforeEach(() => {
      formatter = GoldSrcColorFormatter.withColors()
    })

    it("should format tag with color codes", () => {
      expect(formatter.formatTag("[HLStatsNext]")).toBe("^2[HLStatsNext]^0")
    })

    it("should format positive and negative points with appropriate colors", () => {
      expect(formatter.formatPoints(25)).toBe("^2+25^0")
      expect(formatter.formatPoints(-10)).toBe("^1-10^0")
      expect(formatter.formatPoints(0)).toBe("^10^0") // 0 is treated as negative
    })

    it("should format actions with color codes", () => {
      expect(formatter.formatAction("Plant the Bomb")).toBe("^6Plant the Bomb^0")
    })

    it("should format ranks with color codes", () => {
      expect(formatter.formatRank(15)).toBe("^3#15^0")
    })

    it("should format player names with team-specific colors", () => {
      expect(formatter.formatPlayerName("Player1", "CT")).toBe("^4Player1^0")
      expect(formatter.formatPlayerName("Player2", "TERRORIST")).toBe("^1Player2^0")
      expect(formatter.formatPlayerName("Player3", "SPECTATOR")).toBe("^8Player3^0")
      expect(formatter.formatPlayerName("Player4", "UNKNOWN")).toBe("^0Player4^0")
    })

    it("should support colors when enabled", () => {
      expect(formatter.supportsColors()).toBe(true)
    })

    it("should handle case insensitive team names", () => {
      expect(formatter.formatPlayerName("Player1", "ct")).toBe("^4Player1^0")
      expect(formatter.formatPlayerName("Player2", "terrorist")).toBe("^1Player2^0")
    })
  })
})

describe("SourceColorFormatter", () => {
  describe("without colors enabled", () => {
    let formatter: IColorFormatter

    beforeEach(() => {
      formatter = SourceColorFormatter.withoutColors()
    })

    it("should format text without color codes when colors are disabled", () => {
      expect(formatter.formatTag("[HLStatsNext]")).toBe("[HLStatsNext]")
      expect(formatter.formatPlayerName("TestPlayer")).toBe("TestPlayer")
      expect(formatter.formatPoints(25)).toBe("+25")
      expect(formatter.formatAction("Plant the Bomb")).toBe("Plant the Bomb")
    })

    it("should not support colors when disabled", () => {
      expect(formatter.supportsColors()).toBe(false)
    })
  })

  describe("with colors enabled", () => {
    let formatter: IColorFormatter

    beforeEach(() => {
      formatter = SourceColorFormatter.withColors()
    })

    it("should format tag with Source engine color codes", () => {
      expect(formatter.formatTag("[HLStatsNext]")).toBe("\x04[HLStatsNext]\x01")
    })

    it("should format positive and negative points with appropriate colors", () => {
      expect(formatter.formatPoints(25)).toBe("\x04+25\x01")
      expect(formatter.formatPoints(-10)).toBe("\x02-10\x01")
    })

    it("should format actions with color codes", () => {
      expect(formatter.formatAction("Plant the Bomb")).toBe("\x06Plant the Bomb\x01")
    })

    it("should format ranks with color codes", () => {
      expect(formatter.formatRank(15)).toBe("\x09#15\x01")
    })

    it("should format player names with team-specific colors", () => {
      expect(formatter.formatPlayerName("Player1", "CT")).toBe("\x0CPlayer1\x01")
      expect(formatter.formatPlayerName("Player2", "TERRORIST")).toBe("\x07Player2\x01")
      expect(formatter.formatPlayerName("Player3", "SPECTATOR")).toBe("\x08Player3\x01")
      expect(formatter.formatPlayerName("Player4", "UNKNOWN")).toBe("\x01Player4\x01")
    })

    it("should support colors when enabled", () => {
      expect(formatter.supportsColors()).toBe(true)
    })

    it("should handle case insensitive team names", () => {
      expect(formatter.formatPlayerName("Player1", "ct")).toBe("\x0CPlayer1\x01")
      expect(formatter.formatPlayerName("Player2", "t")).toBe("\x07Player2\x01")
    })
  })
})

describe("ColorFormatterFactory", () => {
  it("should create plain text formatter when colors are disabled", () => {
    const formatter = ColorFormatterFactory.create("goldsrc", false)
    expect(formatter.supportsColors()).toBe(false)
    expect(formatter).toBeInstanceOf(PlainTextFormatter)
  })

  it("should create GoldSrc formatter for goldsrc engine", () => {
    const formatter = ColorFormatterFactory.create("goldsrc", true)
    expect(formatter.supportsColors()).toBe(true)
    expect(formatter).toBeInstanceOf(GoldSrcColorFormatter)
  })

  it("should create Source formatter for source engine", () => {
    const formatter = ColorFormatterFactory.create("source", true)
    expect(formatter.supportsColors()).toBe(true)
    expect(formatter).toBeInstanceOf(SourceColorFormatter)
  })

  it("should create Source formatter for source2 engine", () => {
    const formatter = ColorFormatterFactory.create("source2", true)
    expect(formatter.supportsColors()).toBe(true)
    expect(formatter).toBeInstanceOf(SourceColorFormatter)
  })

  it("should fallback to plain text for unknown engine types", () => {
    // @ts-expect-error Testing invalid engine type
    const formatter = ColorFormatterFactory.create("unknown", true)
    expect(formatter).toBeInstanceOf(PlainTextFormatter)
  })

  it("should validate engine types correctly", () => {
    expect(ColorFormatterFactory.isValidEngineType("goldsrc")).toBe(true)
    expect(ColorFormatterFactory.isValidEngineType("source")).toBe(true)
    expect(ColorFormatterFactory.isValidEngineType("source2")).toBe(true)
    expect(ColorFormatterFactory.isValidEngineType("unknown")).toBe(false)
  })

  it("should return supported engine types", () => {
    const supportedTypes = ColorFormatterFactory.getSupportedEngineTypes()
    expect(supportedTypes).toEqual(["goldsrc", "source", "source2"])
  })

  it("should create plain text formatter via factory method", () => {
    const formatter = ColorFormatterFactory.createPlainText()
    expect(formatter).toBeInstanceOf(PlainTextFormatter)
    expect(formatter.supportsColors()).toBe(false)
  })

  it("should create formatter for testing", () => {
    const formatter = ColorFormatterFactory.createForTesting("source", true)
    expect(formatter.supportsColors()).toBe(true)
    expect(formatter).toBeInstanceOf(SourceColorFormatter)
  })

  it("should parse custom color scheme from JSON", () => {
    const customScheme = {
      tag: "#FF0000",
      playerName: "#00FF00",
      positivePoints: "#0000FF",
      team: {
        CT: "#FFFF00",
      },
    }

    const formatter = ColorFormatterFactory.create("goldsrc", false, customScheme)
    const parsedScheme = formatter.getColorScheme()

    expect(parsedScheme.tag).toBe("#FF0000")
    expect(parsedScheme.playerName).toBe("#00FF00")
    expect(parsedScheme.positivePoints).toBe("#0000FF")
    expect(parsedScheme.team.CT).toBe("#FFFF00")
    // Should merge with defaults
    expect(parsedScheme.negativePoints).toBe(DEFAULT_COLOR_SCHEME.negativePoints)
    expect(parsedScheme.team.TERRORIST).toBe(DEFAULT_COLOR_SCHEME.team.TERRORIST)
  })

  it("should handle invalid JSON color scheme gracefully", () => {
    const formatter = ColorFormatterFactory.create("goldsrc", false, "invalid")
    expect(formatter.getColorScheme()).toEqual(DEFAULT_COLOR_SCHEME)
  })

  it("should handle null color scheme", () => {
    const formatter = ColorFormatterFactory.create("goldsrc", false, null)
    expect(formatter.getColorScheme()).toEqual(DEFAULT_COLOR_SCHEME)
  })
})

describe("Color Formatter Edge Cases", () => {
  it("should handle empty strings correctly", () => {
    const formatter = GoldSrcColorFormatter.withColors()

    expect(formatter.formatTag("")).toBe("^2^0")
    expect(formatter.formatPlayerName("")).toBe("")
    expect(formatter.formatAction("")).toBe("^6^0")
  })

  it("should handle zero points correctly", () => {
    const plainFormatter = new PlainTextFormatter()
    const colorFormatter = GoldSrcColorFormatter.withColors()

    expect(plainFormatter.formatPoints(0)).toBe("0")
    expect(colorFormatter.formatPoints(0)).toBe("^10^0") // Treated as negative
  })

  it("should handle very large numbers", () => {
    const formatter = new PlainTextFormatter()

    expect(formatter.formatPoints(999999)).toBe("+999999")
    expect(formatter.formatPoints(-999999)).toBe("-999999")
    expect(formatter.formatRank(999999)).toBe("#999999")
  })

  it("should handle special characters in names", () => {
    const formatter = GoldSrcColorFormatter.withColors()

    expect(formatter.formatPlayerName("Player[TAG]", "CT")).toBe("^4Player[TAG]^0")
    expect(formatter.formatPlayerName("Player-123_test", "TERRORIST")).toBe("^1Player-123_test^0")
  })
})
