/**
 * Source Engine Color Formatter
 *
 * Handles color formatting for Source engine games (CS:GO, CS2, TF2, etc.)
 * Uses Source engine color codes and control characters.
 */

import type { IColorFormatter, ColorScheme } from "./color-formatter.interface"
import { DEFAULT_COLOR_SCHEME } from "./color-formatter.interface"

export class SourceColorFormatter implements IColorFormatter {
  private colorScheme: ColorScheme
  private enableColors: boolean

  constructor(colorScheme: ColorScheme = DEFAULT_COLOR_SCHEME, enableColors: boolean = true) {
    this.colorScheme = colorScheme
    this.enableColors = enableColors
  }

  formatTag(text: string): string {
    if (!this.enableColors) {
      return text
    }
    // Use green color for the tag
    return `\x04${text}\x01`
  }

  formatPlayerName(name: string, team?: string): string {
    if (!this.enableColors) {
      return name
    }

    // Use team-specific colors if available
    if (team) {
      const teamColor = this.getTeamColorCode(team)
      return `${teamColor}${name}\x01`
    }

    // Default color (usually white)
    return `\x01${name}`
  }

  formatPoints(points: number): string {
    const pointsText = points > 0 ? `+${points}` : `${points}`

    if (!this.enableColors) {
      return pointsText
    }

    // Green for positive, red for negative
    const colorCode = points > 0 ? "\x04" : "\x02"
    return `${colorCode}${pointsText}\x01`
  }

  formatAction(action: string): string {
    if (!this.enableColors) {
      return action
    }
    // Use cyan/light blue for actions
    return `\x06${action}\x01`
  }

  formatRank(rank: number): string {
    const rankText = `#${rank}`

    if (!this.enableColors) {
      return rankText
    }
    // Use yellow for ranks
    return `\x09${rankText}\x01`
  }

  supportsColors(): boolean {
    return this.enableColors
  }

  getColorScheme(): ColorScheme {
    return this.colorScheme
  }

  /**
   * Get Source engine color code for team
   */
  private getTeamColorCode(team: string): string {
    switch (team.toUpperCase()) {
      case "CT":
      case "COUNTER-TERRORIST":
        return "\x0C" // Light blue
      case "TERRORIST":
      case "T":
        return "\x07" // Red
      case "SPECTATOR":
        return "\x08" // Gray
      default:
        return "\x01" // Default
    }
  }

  /**
   * Create a Source formatter with colors enabled
   */
  static withColors(colorScheme?: ColorScheme): SourceColorFormatter {
    return new SourceColorFormatter(colorScheme, true)
  }

  /**
   * Create a Source formatter with colors disabled
   */
  static withoutColors(colorScheme?: ColorScheme): SourceColorFormatter {
    return new SourceColorFormatter(colorScheme, false)
  }
}

/**
 * Source Engine Color Codes Reference:
 *
 * \x01 = Default (white/console default)
 * \x02 = Red
 * \x03 = Team Color (CT/T specific)
 * \x04 = Green
 * \x05 = Light Green
 * \x06 = Green/Cyan
 * \x07 = Red/Orange
 * \x08 = Gray
 * \x09 = Yellow
 * \x0A = Light Blue
 * \x0B = Blue
 * \x0C = Light Blue
 * \x0D = Purple
 * \x0E = Red/Pink
 * \x0F = Light Red
 * \x10 = Orange
 */
