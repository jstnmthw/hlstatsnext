/**
 * Base Parser for HLStats Log Processing
 *
 * Abstract base class that defines the interface for parsing
 * game server log lines into structured events.
 */

import type { GameEvent } from "@/types/common/events"

export type ParseResult =
  | {
      success: true
      event: GameEvent
    }
  | { success: false; error: string }

export abstract class BaseParser {
  protected readonly gameType: string

  constructor(gameType: string) {
    this.gameType = gameType
  }

  /**
   * Parse a raw log line into a structured GameEvent
   */
  abstract parse(logLine: string, serverId: number): Promise<ParseResult>

  /**
   * Validate that a log line is supported by this parser
   */
  abstract canParse(logLine: string): boolean

  /**
   * Extract basic event information from a log line
   */
  protected extractBasicInfo(logLine: string): {
    timestamp: Date
    content: string
  } {
    // Match HLStats timestamp format: L MM/DD/YYYY - HH:MM:SS:
    const timestampMatch = logLine.match(/^L (\d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}:\d{2}):\s*(.*)/)

    if (!timestampMatch || timestampMatch.length < 3) {
      throw new Error("Invalid log line format - missing timestamp")
    }

    const timestampStr = timestampMatch[1]!
    const content = timestampMatch[2]!
    const timestamp = this.parseTimestamp(timestampStr)

    return { timestamp, content }
  }

  /**
   * Parse timestamp from HLStats format
   */
  private parseTimestamp(timestampStr: string): Date {
    // Format: MM/DD/YYYY - HH:MM:SS
    const match = timestampStr.match(/(\d{2})\/(\d{2})\/(\d{4}) - (\d{2}):(\d{2}):(\d{2})/)

    if (!match || match.length < 7) {
      throw new Error(`Invalid timestamp format: ${timestampStr}`)
    }

    const month = match[1]!
    const day = match[2]!
    const year = match[3]!
    const hour = match[4]!
    const minute = match[5]!
    const second = match[6]!

    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1, // Month is 0-indexed
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10),
    )
  }

  /**
   * Extract player information from a player string
   * Format: "PlayerName<uid><STEAM_ID><team>"
   */
  protected parsePlayerInfo(playerStr: string): {
    name: string
    steamId: string
    team: string
    isBot: boolean
  } {
    // Match player format: "Name<uid><steamid><team>"
    const match = playerStr.match(/^"([^"]+)"<(\d+)><([^>]+)><([^>]*)>$/)

    if (!match || match.length < 5) {
      throw new Error(`Invalid player format: ${playerStr}`)
    }

    const name = match[1]!
    const steamId = match[3]!
    const team = match[4]!

    // Detect bots - they typically have "BOT" as Steam ID or specific patterns
    const isBot = steamId === "BOT" || steamId.startsWith("BOT_") || name.includes("BOT")

    return {
      name: name.trim(),
      steamId: steamId.trim(),
      team: team.trim(),
      isBot,
    }
  }

  /**
   * Extract position coordinates from a position string
   * Format: "x y z"
   */
  protected parsePosition(positionStr: string): { x: number; y: number; z: number } | undefined {
    const match = positionStr.match(/^([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)$/)

    if (!match || match.length < 4) {
      return undefined
    }

    const x = match[1]!
    const y = match[2]!
    const z = match[3]!

    return {
      x: parseFloat(x),
      y: parseFloat(y),
      z: parseFloat(z),
    }
  }

  /**
   * Check if a string contains a weapon name
   */
  protected isValidWeapon(weapon: string): boolean {
    // Basic weapon validation - can be expanded
    return weapon.length > 0 && !weapon.includes("<") && !weapon.includes(">")
  }

  /**
   * Extract server information if present in log line
   */
  protected extractServerInfo(): {
    address?: string
    port?: number
  } {
    // This will be implemented by specific parsers as needed
    return {}
  }

  /**
   * Sanitize player names and other user input
   */
  protected sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, "") // Remove potential HTML tags
      .trim()
      .substring(0, 255) // Limit length
  }

  /**
   * Normalise a raw UDP log packet into a clean log line that the
   * individual game parsers can work with.
   *
   * Source-engine remote log packets are typically prefixed with four 0xFF
   * bytes followed by the literal string "log ".  For example:
   *   "\xff\xff\xff\xfflog L 06/28/2025 - 08:42:47: ..."
   *
   * This helper trims those extra bytes/tokens so the resulting string
   * always starts with the canonical "L " prefix expected by the regexes.
   */
  protected normaliseLogLine(raw: string): string {
    // Trim early to remove leading whitespace
    let line = raw.trimStart()

    // If the line already starts with "L " no further work is needed
    if (line.startsWith("L ")) {
      return line
    }

    // Attempt to locate the first occurrence of the canonical prefix.
    const idx = line.indexOf("L ")
    if (idx !== -1) {
      line = line.substring(idx)
    }

    return line.trimStart()
  }
}
