/**
 * Game Configuration Service
 *
 * Database-driven game configuration with fallback defaults.
 * This replaces hardcoded game lists with dynamic database loading.
 */

import type { DatabaseClient } from "@/database/client"
import type { ILogger } from "@/shared/utils/logger.types"

// Minimal hardcoded configuration for bootstrapping/fallback
export const BOOTSTRAP_CONFIG = {
  DEFAULT_GAME: "cstrike" as const,
  MAP: {
    UNKNOWN: "unknown",
    FALLBACK: "",
  } as const,
} as const

export interface GameRecord {
  code: string
  name: string
  hidden: boolean
  realgame: string
}

export interface GamePattern {
  pattern: string
  gameCode: string
}

export class GameConfigService {
  private static instance: GameConfigService | null = null
  private games: Map<string, GameRecord> = new Map()
  private gamePatterns: Map<string, string> = new Map()
  private initialized = false

  constructor(
    private readonly db: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  static getInstance(db?: DatabaseClient, logger?: ILogger): GameConfigService {
    if (!GameConfigService.instance && db && logger) {
      GameConfigService.instance = new GameConfigService(db, logger)
    }
    if (!GameConfigService.instance) {
      throw new Error("GameConfigService must be initialized with db and logger first")
    }
    return GameConfigService.instance
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Load games from database
      const games = await this.db.prisma.game.findMany({
        where: { hidden: "0" }, // Only non-hidden games
      })

      const supportedGames = await this.db.prisma.gameSupported.findMany()

      // Cache games
      for (const game of games) {
        this.games.set(game.code, {
          code: game.code,
          name: game.name,
          hidden: game.hidden === "1",
          realgame: game.realgame,
        })
      }

      // Add supported games that might not be in main Games table
      for (const supported of supportedGames) {
        if (!this.games.has(supported.code)) {
          this.games.set(supported.code, {
            code: supported.code,
            name: supported.name,
            hidden: false,
            realgame: supported.code, // fallback
          })
        }
      }

      // Load game detection patterns (could be extended to database table later)
      this.initializePatterns()

      this.initialized = true
      this.logger.info(`Loaded ${this.games.size} games from database`)
    } catch (error) {
      this.logger.error(`Failed to load games from database, using fallbacks: ${String(error)}`)
      this.initializeFallbacks()
    }
  }

  private initializePatterns(): void {
    // These patterns could eventually move to a database table
    const patterns = [
      { pattern: "counter-strike", gameCode: "cstrike" },
      { pattern: "counter-strike: source", gameCode: "css" },
      { pattern: "counter-strike: global offensive", gameCode: "csgo" },
      { pattern: "counter-strike 2", gameCode: "csgo" },
      { pattern: "team fortress 2", gameCode: "tf2" },
      { pattern: "team fortress classic", gameCode: "tfc" },
      { pattern: "half-life 2: deathmatch", gameCode: "hl2dm" },
      { pattern: "left 4 dead 2", gameCode: "l4d2" },
    ]

    for (const { pattern, gameCode } of patterns) {
      this.gamePatterns.set(pattern.toLowerCase(), gameCode)
    }
  }

  private initializeFallbacks(): void {
    // Minimal fallback games when database is unavailable
    const fallbackGames = [
      { code: "cstrike", name: "Counter-Strike", hidden: false, realgame: "cstrike" },
      { code: "css", name: "Counter-Strike: Source", hidden: false, realgame: "css" },
      { code: "csgo", name: "Counter-Strike: Global Offensive", hidden: false, realgame: "csgo" },
      { code: "tf2", name: "Team Fortress 2", hidden: false, realgame: "tf2" },
    ]

    for (const game of fallbackGames) {
      this.games.set(game.code, game)
    }
    this.initialized = true
  }

  // Public API
  getDefaultGame(): string {
    return BOOTSTRAP_CONFIG.DEFAULT_GAME
  }

  isValidGame(gameCode: string): boolean {
    this.ensureInitialized()
    return this.games.has(gameCode)
  }

  getGameCodes(): string[] {
    this.ensureInitialized()
    return Array.from(this.games.keys())
  }

  getGameName(gameCode: string): string | null {
    this.ensureInitialized()
    return this.games.get(gameCode)?.name || null
  }

  getGameFromPattern(pattern: string): string | null {
    this.ensureInitialized()
    const normalizedPattern = pattern.toLowerCase().trim()
    return this.gamePatterns.get(normalizedPattern) || null
  }

  getAllGames(): GameRecord[] {
    this.ensureInitialized()
    return Array.from(this.games.values())
  }

  getUnknownMap(): string {
    return BOOTSTRAP_CONFIG.MAP.UNKNOWN
  }

  getMapFallback(): string {
    return BOOTSTRAP_CONFIG.MAP.FALLBACK
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("GameConfigService not initialized. Call initialize() first.")
    }
  }

  // For testing/development - reset the singleton
  static reset(): void {
    GameConfigService.instance = null
  }
}

// Simple compatibility functions for legacy code
export const getDefaultGame = (): string => BOOTSTRAP_CONFIG.DEFAULT_GAME
export const getUnknownMap = (): string => BOOTSTRAP_CONFIG.MAP.UNKNOWN
