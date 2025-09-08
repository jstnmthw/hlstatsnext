/**
 * GoldSrc Color Formatter
 *
 * Handles color formatting for GoldSrc engine games (Half-Life, Counter-Strike 1.6, etc.)
 * Note: Vanilla GoldSrc doesn't support colored text. This is for plugin-enabled servers
 * that support color codes like ^1, ^2, etc. (typically AMX Mod X or similar plugins).
 */

import type { IColorFormatter, ColorScheme } from "./color-formatter.interface"
import { DEFAULT_COLOR_SCHEME } from "./color-formatter.interface"

export class GoldSrcColorFormatter implements IColorFormatter {
  private colorScheme: ColorScheme
  private enableColors: boolean

  constructor(colorScheme: ColorScheme = DEFAULT_COLOR_SCHEME, enableColors: boolean = false) {
    this.colorScheme = colorScheme
    this.enableColors = enableColors
  }

  formatTag(text: string): string {
    if (!this.enableColors) {
      return text
    }
    // ^2 is typically green in AMX Mod X color systems
    return `^2${text}^0`
  }

  formatPlayerName(name: string, team?: string): string {
    if (!this.enableColors) {
      return name
    }

    // Use team-specific colors if available
    if (team) {
      const teamColor = this.getTeamColorCode(team)
      return `${teamColor}${name}^0`
    }

    // Default to white (^0 or no color code)
    return name
  }

  formatPoints(points: number): string {
    const pointsText = points > 0 ? `+${points}` : `${points}`

    if (!this.enableColors) {
      return pointsText
    }

    // ^2 for positive (green), ^1 for negative (red)
    const colorCode = points > 0 ? "^2" : "^1"
    return `${colorCode}${pointsText}^0`
  }

  formatAction(action: string): string {
    if (!this.enableColors) {
      return action
    }
    // ^6 is typically cyan/light blue in AMX color systems
    return `^6${action}^0`
  }

  formatRank(rank: number): string {
    const rankText = `#${rank}`

    if (!this.enableColors) {
      return rankText
    }
    // ^3 is typically yellow in AMX color systems
    return `^3${rankText}^0`
  }

  supportsColors(): boolean {
    return this.enableColors
  }

  getColorScheme(): ColorScheme {
    return this.colorScheme
  }

  /**
   * Get AMX Mod X color code for team
   */
  private getTeamColorCode(team: string): string {
    switch (team.toUpperCase()) {
      case "CT":
      case "COUNTER-TERRORIST":
        return "^4" // Blue
      case "TERRORIST":
      case "T":
        return "^1" // Red
      case "SPECTATOR":
        return "^8" // Gray (if supported)
      default:
        return "^0" // Default/white
    }
  }

  /**
   * Create a GoldSrc formatter with colors enabled (for plugin-enabled servers)
   */
  static withColors(colorScheme?: ColorScheme): GoldSrcColorFormatter {
    return new GoldSrcColorFormatter(colorScheme, true)
  }

  /**
   * Create a GoldSrc formatter with colors disabled (for vanilla servers)
   */
  static withoutColors(colorScheme?: ColorScheme): GoldSrcColorFormatter {
    return new GoldSrcColorFormatter(colorScheme, false)
  }
}
