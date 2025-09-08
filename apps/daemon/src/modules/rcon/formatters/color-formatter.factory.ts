/**
 * Color Formatter Factory
 *
 * Creates appropriate color formatter instances based on engine type and configuration.
 */

import type { Prisma } from "@repo/database/client"
import type { IColorFormatter, ColorScheme } from "./color-formatter.interface"
import { DEFAULT_COLOR_SCHEME } from "./color-formatter.interface"
import { PlainTextFormatter } from "./plain-text.formatter"
import { GoldSrcColorFormatter } from "./goldsrc-color.formatter"
import { SourceColorFormatter } from "./source-color.formatter"

export type EngineType = "goldsrc" | "source" | "source2"

export class ColorFormatterFactory {
  /**
   * Create a color formatter based on engine type and configuration
   */
  static create(
    engineType: EngineType,
    colorEnabled: boolean = false,
    colorSchemeJson?: Prisma.JsonValue,
  ): IColorFormatter {
    // Parse color scheme from JSON if provided
    const colorScheme: ColorScheme = this.parseColorScheme(colorSchemeJson)

    if (!colorEnabled) {
      return new PlainTextFormatter(colorScheme)
    }

    switch (engineType) {
      case "goldsrc":
        return GoldSrcColorFormatter.withColors(colorScheme)

      case "source":
      case "source2":
        return SourceColorFormatter.withColors(colorScheme)

      default:
        // Fallback to plain text for unknown engines
        return new PlainTextFormatter(colorScheme)
    }
  }

  /**
   * Create a plain text formatter (no colors)
   */
  static createPlainText(colorSchemeJson?: Prisma.JsonValue): IColorFormatter {
    const colorScheme = this.parseColorScheme(colorSchemeJson)
    return new PlainTextFormatter(colorScheme)
  }

  /**
   * Create a formatter for testing purposes
   */
  static createForTesting(engineType: EngineType, colorEnabled: boolean = true): IColorFormatter {
    return this.create(engineType, colorEnabled, null)
  }

  /**
   * Parse color scheme from JSON configuration
   */
  private static parseColorScheme(colorSchemeJson?: Prisma.JsonValue): ColorScheme {
    if (!colorSchemeJson || typeof colorSchemeJson !== "object") {
      return DEFAULT_COLOR_SCHEME
    }

    try {
      // Validate and merge with default scheme
      const parsed = colorSchemeJson as Partial<ColorScheme>
      return {
        tag: parsed.tag || DEFAULT_COLOR_SCHEME.tag,
        playerName: parsed.playerName || DEFAULT_COLOR_SCHEME.playerName,
        positivePoints: parsed.positivePoints || DEFAULT_COLOR_SCHEME.positivePoints,
        negativePoints: parsed.negativePoints || DEFAULT_COLOR_SCHEME.negativePoints,
        rank: parsed.rank || DEFAULT_COLOR_SCHEME.rank,
        action: parsed.action || DEFAULT_COLOR_SCHEME.action,
        team: {
          ...DEFAULT_COLOR_SCHEME.team,
          ...parsed.team,
        },
      }
    } catch {
      // Return default scheme if parsing fails
      return DEFAULT_COLOR_SCHEME
    }
  }

  /**
   * Validate engine type string
   */
  static isValidEngineType(engineType: string): engineType is EngineType {
    return ["goldsrc", "source", "source2"].includes(engineType)
  }

  /**
   * Get supported engine types
   */
  static getSupportedEngineTypes(): EngineType[] {
    return ["goldsrc", "source", "source2"]
  }
}
