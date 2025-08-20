/**
 * Base Status Response Parser
 *
 * Abstract base class for parsing server status responses.
 * Follows the project's DDD architecture and extensibility principles.
 */

import type { ServerStatus } from "../rcon.types"
import type { ILogger } from "@/shared/utils/logger.types"

/**
 * Raw status line with key-value data
 */
export interface StatusLine {
  readonly key: string
  readonly value: string
  readonly rawLine: string
}

/**
 * Abstract base parser for server status responses
 */
export abstract class BaseStatusParser {
  constructor(protected readonly logger: ILogger) {}

  /**
   * Parses a status response string into ServerStatus object
   */
  abstract parseStatus(response: string): ServerStatus

  /**
   * Extracts key-value pairs from status response lines
   */
  protected extractStatusLines(response: string): StatusLine[] {
    const lines = response.split("\n")
    const statusLines: StatusLine[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const statusLine = this.parseStatusLine(trimmed)
      if (statusLine) {
        statusLines.push(statusLine)
      }
    }

    return statusLines
  }

  /**
   * Parses a single status line into key-value pair
   */
  protected parseStatusLine(line: string): StatusLine | null {
    const colonIndex = line.indexOf(":")
    if (colonIndex === -1) return null

    const key = line.substring(0, colonIndex).trim().toLowerCase()
    const value = line.substring(colonIndex + 1).trim()

    return {
      key,
      value,
      rawLine: line,
    }
  }

  /**
   * Creates default status object with current timestamp
   */
  protected createDefaultStatus(): ServerStatus {
    return {
      map: "unknown",
      players: 0,
      maxPlayers: 0,
      uptime: 0,
      fps: 0,
      timestamp: new Date(),
    }
  }

  /**
   * Safely parses integer values
   */
  protected parseInt(value: string, fallback: number = 0): number {
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? fallback : parsed
  }

  /**
   * Safely parses float values
   */
  protected parseFloat(value: string, fallback: number = 0): number {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? fallback : parsed
  }

  /**
   * Logs parsing debug information
   */
  protected logParsingResult(status: ServerStatus): void {
    this.logger.debug("📊 Parsed server status", {
      hostname: status.hostname,
      map: status.map,
      players: `${status.players}/${status.maxPlayers}`,
      version: status.version,
    })
  }
}
