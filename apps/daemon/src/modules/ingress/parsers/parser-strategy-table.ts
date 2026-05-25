/**
 * Parser Strategy Table
 *
 * Maps log-line substring patterns to handler functions. Ordered, first-match
 * wins. The substring check (rather than regex) is intentional: it is fast and
 * matches the legacy HLstatsX dispatch behavior byte-for-byte.
 */

import type { ParseResult } from "./base.parser"

export type ParserHandler = (line: string, serverId: number) => ParseResult

export interface ParserStrategy {
  patterns: string[]
  handler: ParserHandler
}

export class ParserStrategyTable {
  constructor(private readonly strategies: ReadonlyArray<ParserStrategy>) {}

  dispatch(cleanLine: string, serverId: number): ParseResult | null {
    for (const strategy of this.strategies) {
      if (strategy.patterns.some((pattern) => cleanLine.includes(pattern))) {
        return strategy.handler(cleanLine, serverId)
      }
    }
    return null
  }
}
