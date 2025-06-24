/**
 * Base Parser for HLStats Log Processing
 *
 * Abstract base class that defines the interface for parsing
 * game server log lines into structured events.
 */

import type { GameEvent } from "@/types/common/events";

export type ParseResult =
  | { success: true; event: GameEvent }
  | { success: false; error: string };

export abstract class BaseParser {
  protected readonly gameType: string;

  constructor(gameType: string) {
    this.gameType = gameType;
  }

  /**
   * Parse a raw log line into a structured GameEvent
   */
  abstract parse(logLine: string, serverId: number): Promise<ParseResult>;

  /**
   * Validate that a log line is supported by this parser
   */
  abstract canParse(logLine: string): boolean;

  /**
   * Extract timestamp from log line (common across most formats)
   */
  protected extractTimestamp(logLine: string): Date | null {
    // Common format: L 12/31/2023 - 23:59:59:
    const timestampMatch = logLine.match(
      /^L (\d{2}\/\d{2}\/\d{4}) - (\d{2}:\d{2}:\d{2}):/
    );

    if (!timestampMatch) {
      return null;
    }

    const [, dateStr, timeStr] = timestampMatch;
    return new Date(`${dateStr} ${timeStr}`);
  }

  /**
   * Extract server information if present in log line
   */
  protected extractServerInfo(): {
    address?: string;
    port?: number;
  } {
    // This will be implemented by specific parsers as needed
    return {};
  }

  /**
   * Sanitize player names and other user input
   */
  protected sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, "") // Remove potential HTML tags
      .trim()
      .substring(0, 255); // Limit length
  }
}
