/**
 * Color Formatter Interface
 *
 * Provides a consistent interface for formatting text with colors
 * across different game engines (GoldSrc, Source, etc.)
 */

export interface ColorScheme {
  /** Color for the [HLStatsNext] tag */
  tag: string
  /** Color for player names */
  playerName: string
  /** Color for positive point values (gains) */
  positivePoints: string
  /** Color for negative point values (losses) */
  negativePoints: string
  /** Color for rank numbers */
  rank: string
  /** Color for action names */
  action: string
  /** Team-specific colors */
  team: {
    CT: string
    TERRORIST: string
    [key: string]: string
  }
}

export interface IColorFormatter {
  /**
   * Format a tag like [HLStatsNext] with appropriate colors
   */
  formatTag(text: string): string

  /**
   * Format a player name with optional team-based coloring
   */
  formatPlayerName(name: string, team?: string): string

  /**
   * Format point values with appropriate color (green for positive, red for negative)
   */
  formatPoints(points: number): string

  /**
   * Format action names with appropriate color
   */
  formatAction(action: string): string

  /**
   * Format rank numbers with appropriate color
   */
  formatRank(rank: number): string

  /**
   * Check if this formatter supports colors
   * @returns true if colors are supported, false for plain text only
   */
  supportsColors(): boolean

  /**
   * Get the color scheme being used by this formatter
   */
  getColorScheme(): ColorScheme
}

/**
 * Default color scheme for game servers
 */
export const DEFAULT_COLOR_SCHEME: ColorScheme = {
  tag: "#00FF00", // Green for [HLStatsNext]
  playerName: "#FFFFFF", // White for player names
  positivePoints: "#00FF00", // Green for positive points
  negativePoints: "#FF0000", // Red for negative points
  rank: "#FFFF00", // Yellow for ranks
  action: "#00FFFF", // Cyan for actions
  team: {
    CT: "#0099FF", // Blue for Counter-Terrorists
    TERRORIST: "#FF9900", // Orange for Terrorists
    SPECTATOR: "#CCCCCC", // Gray for spectators
    UNASSIGNED: "#FFFFFF", // White for unassigned
  },
}
