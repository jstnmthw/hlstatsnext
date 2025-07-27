import type { ILogger } from "@/shared/utils/logger.types"
import type { GameDetectionResult, IGameDetectionService } from "./game-detection.types"
import { GameConfig, GAMES } from "@/config/game.config"

export class GameDetectionService implements IGameDetectionService {
  private readonly gameCache = new Map<string, { result: GameDetectionResult; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(private readonly logger: ILogger) {}

  /**
   * Detect game type from log content patterns
   * This is a fallback method when server queries are not available
   */
  detectGameFromLogContent(logLines: string[]): GameDetectionResult {
    const patterns = {
      [GAMES.COUNTER_STRIKE_GO]: {
        patterns: [
          /CT.*TERRORIST/i,
          /weapon_ak47|weapon_m4a1|weapon_awp/i,
          /planted_c4|defused_c4/i,
          /Round_Start.*cs_/i,
        ],
        weight: 1,
      },
      [GAMES.COUNTER_STRIKE_SOURCE]: {
        patterns: [
          /CT.*Terrorist/i,
          /weapon_ak47|weapon_m4a1|weapon_awp/i,
          /Round_Start.*de_|cs_/i,
        ],
        weight: 1,
      },
      [GAMES.TEAM_FORTRESS_2]: {
        patterns: [
          /Red.*Blue/i,
          /sentry_built|dispenser_built|teleporter_built/i,
          /medic_uber|spy_backstab|engineer_built/i,
          /cp_|pl_|ctf_|koth_/i,
        ],
        weight: 1,
      },
      [GAMES.TEAM_FORTRESS_CLASSIC]: {
        patterns: [/Red.*Blue/i, /flag_captured|flag_returned/i, /sentry_gun|dispenser/i],
        weight: 1,
      },
      [GAMES.HALF_LIFE_2_DEATHMATCH]: {
        patterns: [/weapon_crowbar|weapon_physcannon/i, /dm_|hl2mp_/i],
        weight: 1,
      },
      [GAMES.LEFT_4_DEAD_2]: {
        patterns: [
          /Infected.*Survivor/i,
          /infected_hurt|survivor_rescued/i,
          /weapon_rifle_|weapon_shotgun_/i,
          /c1m1_|c2m1_|dark/i,
        ],
        weight: 1,
      },
    }

    const scores: Record<string, number> = {}
    const logContent = logLines.join("\n")

    // Score each game based on pattern matches
    for (const [gameCode, config] of Object.entries(patterns)) {
      let score = 0
      for (const pattern of config.patterns) {
        const matches = logContent.match(new RegExp(pattern.source, pattern.flags + "g"))
        if (matches) {
          score += matches.length * config.weight
        }
      }
      if (score > 0) {
        scores[gameCode] = score
      }
    }

    // Find the highest scoring game
    const sortedGames = Object.entries(scores).sort(([, a], [, b]) => b - a)

    if (sortedGames.length === 0) {
      // Default fallback - try to detect from common patterns
      if (/weapon_|Round_Start/i.test(logContent)) {
        return {
          gameCode: GAMES.COUNTER_STRIKE_GO,
          confidence: 0.3,
          detection_method: "fallback_pattern",
        }
      }
      return {
        gameCode: "unknown",
        confidence: 0.1,
        detection_method: "no_patterns_matched",
      }
    }

    const [topGame, topScore] = sortedGames[0]!
    const totalMatches = Object.values(scores).reduce((sum, score) => sum + score, 0)
    const confidence = Math.min(topScore / totalMatches, 1.0)

    return {
      gameCode: topGame,
      confidence,
      detection_method: "log_pattern_analysis",
    }
  }

  /**
   * Detect game from server info (when available)
   * This would be implemented when server querying is added
   */
  async detectGameFromServerQuery(address: string, port: number): Promise<GameDetectionResult> {
    // TODO: Implement Source Engine Query protocol
    // For now, return unknown (debug log only once per server per cache period)
    const serverKey = `${address}:${port}`
    const cached = this.gameCache.get(serverKey)
    
    if (!cached) {
      this.logger.debug(`Server query detection not yet implemented for ${address}:${port}`)
    }

    return {
      gameCode: "unknown",
      confidence: 0.0,
      detection_method: "server_query_not_implemented",
    }
  }

  /**
   * Get the best available game detection
   * Tries multiple methods in order of preference
   */
  async detectGame(
    address: string,
    port: number,
    logLines: string[] = [],
  ): Promise<GameDetectionResult> {
    const serverKey = `${address}:${port}`
    
    // Check cache first
    const cached = this.gameCache.get(serverKey)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result
    }

    // Method 1: Try server query (when implemented)
    const serverResult = await this.detectGameFromServerQuery(address, port)
    if (serverResult.gameCode !== "unknown" && serverResult.confidence > 0.7) {
      this.cacheResult(serverKey, serverResult)
      return serverResult
    }

    // Method 2: Try log content analysis
    if (logLines.length > 0) {
      const logResult = this.detectGameFromLogContent(logLines)
      if (logResult.confidence > 0.5) {
        this.cacheResult(serverKey, logResult)
        return logResult
      }
    }

    // Method 3: Check if we have existing server data
    // This would query the database for previously detected game type

    // Fallback: Default to CS:GO for development (only warn once per cache period)
    const fallbackResult = {
      gameCode: GameConfig.getDefaultGame(),
      confidence: 0.2,
      detection_method: "development_fallback",
    }
    
    // Only log warning if not in cache (prevents spam)
    if (!cached) {
      this.logger.warn(`Could not reliably detect game for ${address}:${port}, defaulting to cstrike`)
    }
    
    this.cacheResult(serverKey, fallbackResult)
    return fallbackResult
  }

  private cacheResult(serverKey: string, result: GameDetectionResult): void {
    this.gameCache.set(serverKey, {
      result,
      timestamp: Date.now(),
    })
  }

  /**
   * Map detected game codes to database game codes
   * Handles variations and legacy codes
   */
  normalizeGameCode(detectedCode: string): string {
    const gameCodeMap: Record<string, string> = {
      cs: GAMES.COUNTER_STRIKE_16,
      cstrike: GAMES.COUNTER_STRIKE_16,
      "counter-strike": GAMES.COUNTER_STRIKE_16,
      "counter-strike: source": GAMES.COUNTER_STRIKE_SOURCE,
      "counter-strike: global offensive": GAMES.COUNTER_STRIKE_GO,
      cs2: GAMES.COUNTER_STRIKE_GO, // CS2 uses same tracking as CS:GO for now
      tf2: GAMES.TEAM_FORTRESS_2,
      "team fortress 2": GAMES.TEAM_FORTRESS_2,
      "team fortress classic": GAMES.TEAM_FORTRESS_CLASSIC,
      "half-life 2: deathmatch": GAMES.HALF_LIFE_2_DEATHMATCH,
      "left 4 dead 2": GAMES.LEFT_4_DEAD_2,
      "left 4 dead": "l4d", // Keep this as is since we don't have L4D1 in config
    }

    return gameCodeMap[detectedCode.toLowerCase()] || detectedCode.toLowerCase()
  }
}
