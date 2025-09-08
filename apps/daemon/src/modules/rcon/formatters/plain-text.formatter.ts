/**
 * Plain Text Formatter
 *
 * Provides text formatting without any color codes.
 * Used as fallback for servers that don't support colored text.
 */

import type { IColorFormatter, ColorScheme } from "./color-formatter.interface"
import { DEFAULT_COLOR_SCHEME } from "./color-formatter.interface"

export class PlainTextFormatter implements IColorFormatter {
  private colorScheme: ColorScheme

  constructor(colorScheme: ColorScheme = DEFAULT_COLOR_SCHEME) {
    this.colorScheme = colorScheme
  }

  formatTag(text: string): string {
    return text
  }

  formatPlayerName(name: string): string {
    return name
  }

  formatPoints(points: number): string {
    return points > 0 ? `+${points}` : `${points}`
  }

  formatAction(action: string): string {
    return action
  }

  formatRank(rank: number): string {
    return `#${rank}`
  }

  supportsColors(): boolean {
    return false
  }

  getColorScheme(): ColorScheme {
    return this.colorScheme
  }
}
