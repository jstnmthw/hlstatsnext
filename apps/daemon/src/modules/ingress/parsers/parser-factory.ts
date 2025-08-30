import type { IClock } from "@/shared/infrastructure/time/clock.interface"
import { CsParser } from "./cs.parser"
import type { BaseParser } from "./base.parser"
import { NoopParser } from "./noop.parser"
import { GameConfig } from "@/config/game.config"

export class ParserFactory {
  static create(gameCode: string | undefined, clock: IClock): BaseParser {
    const normalized = (gameCode || GameConfig.getDefaultGame()).toLowerCase()

    // Map known aliases to canonical game codes when needed
    switch (normalized) {
      case "cstrike":
      case "cs":
      case "cs16":
      case "counter-strike":
        return new CsParser("cstrike", clock)

      // Future: add additional game parsers here
      // case "csgo": return new CsgoParser("csgo", clock)
      // case "cs2": return new Cs2Parser("cs2", clock)

      default:
        return new NoopParser(normalized, clock)
    }
  }
}
