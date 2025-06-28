/**
 * Base Parser for HLStats Log Processing
 *
 * Abstract base class that defines the interface for parsing
 * game server log lines into structured events.
 */

import type { GameEvent } from "@/types/common/events";

export type ParseResult =
  | {
      success: true;
      event: GameEvent & {
        meta?: {
          steamId: string;
          playerName: string;
          isBot: boolean;
        };
      };
    }
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
    let line = raw.trimStart();

    // If the line already starts with "L " no further work is needed
    if (line.startsWith("L ")) {
      return line;
    }

    // Attempt to locate the first occurrence of the canonical prefix.
    const idx = line.indexOf("L ");
    if (idx !== -1) {
      line = line.substring(idx);
    }

    return line.trimStart();
  }
}
