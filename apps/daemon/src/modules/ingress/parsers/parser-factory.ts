import { CsParser } from "./cs.parser"
import type { BaseParser } from "./base.parser"
import { NoopParser } from "./noop.parser"
import { GameConfig } from "@/config/game.config"

export class ParserFactory {
  static create(gameCode: string | undefined): BaseParser {
    const normalized = (gameCode || GameConfig.getDefaultGame()).toLowerCase()

    // Map known aliases to canonical game codes when needed
    switch (normalized) {
      case "cstrike":
      case "cs":
      case "cs16":
      case "counter-strike":
        return new CsParser("cstrike")

      // Future: add additional game parsers here
      // case "csgo": return new CsgoParser("csgo")
      // case "cs2": return new Cs2Parser("cs2")

      default:
        return new NoopParser(normalized)
    }
  }
}
