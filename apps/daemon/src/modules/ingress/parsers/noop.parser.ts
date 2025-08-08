/**
 * Noop Parser
 *
 * Fallback parser that does not emit events. Used for unsupported games
 * until a proper parser is implemented.
 */

import { BaseParser, type ParseResult } from "./base.parser"

export class NoopParser extends BaseParser {
  // Always succeed but emit no event to avoid noisy errors for unsupported games
  parseLine(logLine: string, serverId: number): ParseResult {
    // Mark parameters as intentionally unused
    void logLine
    void serverId
    return { event: null, success: true }
  }
}
