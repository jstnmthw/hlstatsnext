/**
 * Base Parser
 *
 * Abstract base class for game log parsers.
 */

import type { BaseEvent } from "@/shared/types/events"
import type { IClock } from "@/shared/infrastructure/time/clock.interface"

export interface ParseResult {
  event: BaseEvent | null
  success: boolean
  error?: string
}

export abstract class BaseParser {
  constructor(
    protected readonly game: string,
    protected readonly clock: IClock,
  ) {}

  abstract parseLine(logLine: string, serverId: number): ParseResult

  protected createTimestamp(dateStr?: string): Date {
    if (dateStr) {
      // Accept ISO format dates (full datetime or date-only)
      if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(dateStr)) {
        const parsed = new Date(dateStr)
        if (!isNaN(parsed.getTime())) {
          return parsed
        }
      }
    }
    return this.clock.now()
  }

  protected extractQuotedValue(text: string, key: string): string | null {
    // Escape special regex characters in the key
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(`${escapedKey}"((?:[^"\\\\]|\\\\.)*)"`, "g")
    const match = regex.exec(text)
    return match ? match[1] || null : null
  }

  protected extractNumericValue(text: string, key: string): number | null {
    // Escape special regex characters in the key
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(`${escapedKey}"([^"]*)"`)
    const match = text.match(regex)
    if (match && match[1] !== "" && !isNaN(Number(match[1]))) {
      return Number(match[1])
    }
    return null
  }
}
