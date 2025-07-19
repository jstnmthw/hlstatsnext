/**
 * ActionService - Manages game-specific actions and their configurations
 *
 * Handles lookup and caching of Actions table data for efficient
 * processing of game events and score calculations.
 */

import type { DatabaseClient } from "@/database/client"
import type { Action } from "@repo/database/client"
import type { ILogger } from "@/utils/logger.types"
import type { IActionService } from "./action.types"

interface ActionWhereClause {
  game: string
  code: string
  team?: string
}

export class ActionService implements IActionService {
  private actionCache = new Map<string, Action>()
  private gameActionsCache = new Map<string, Action[]>()
  private cacheExpiry = new Map<string, number>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(
    private readonly db: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  /**
   * Get action definition by game and code with optional team filtering
   */
  async getAction(game: string, code: string, team?: string): Promise<Action | null> {
    const cacheKey = this.buildCacheKey(game, code, team)

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.actionCache.get(cacheKey)
      if (cached) {
        this.logger.debug(`Action cache hit: ${cacheKey}`)
        return cached
      }
    }

    try {
      // Query database with team preference
      const whereClause: ActionWhereClause = { game, code }

      // If team is specified, try to find team-specific action first
      if (team) {
        const teamSpecificAction = await this.db.prisma.action.findFirst({
          where: { ...whereClause, team },
        })

        if (teamSpecificAction) {
          this.cacheAction(cacheKey, teamSpecificAction)
          return teamSpecificAction
        }
      }

      // Fallback to general action (empty team)
      const generalAction = await this.db.prisma.action.findFirst({
        where: { ...whereClause, team: "" },
      })

      if (generalAction) {
        this.cacheAction(cacheKey, generalAction)
        return generalAction
      }

      // Cache null result to avoid repeated DB queries
      this.cacheAction(cacheKey, null)
      return null
    } catch (error) {
      this.logger.error(
        `Failed to get action ${game}:${code}:${team || "any"}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }

  /**
   * Get all actions for a specific game
   */
  async getGameActions(game: string): Promise<Action[]> {
    const cacheKey = `game:${game}`

    if (this.isCacheValid(cacheKey)) {
      const cached = this.gameActionsCache.get(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      const actions = await this.db.prisma.action.findMany({
        where: { game },
        orderBy: [{ code: "asc" }, { team: "asc" }],
      })

      this.gameActionsCache.set(cacheKey, actions)
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)

      return actions
    } catch (error) {
      this.logger.error(
        `Failed to get actions for game ${game}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return []
    }
  }

  /**
   * Check if an action exists for player actions
   */
  async isPlayerAction(game: string, code: string, team?: string): Promise<boolean> {
    const action = await this.getAction(game, code, team)
    return action?.for_PlayerActions === "1"
  }

  /**
   * Check if an action exists for player-player actions
   */
  async isPlayerPlayerAction(game: string, code: string, team?: string): Promise<boolean> {
    const action = await this.getAction(game, code, team)
    return action?.for_PlayerPlayerActions === "1"
  }

  /**
   * Check if an action exists for team actions
   */
  async isTeamAction(game: string, code: string, team?: string): Promise<boolean> {
    const action = await this.getAction(game, code, team)
    return action?.for_TeamActions === "1"
  }

  /**
   * Get actions by type flags
   */
  async getActionsByType(
    game: string,
    type: "PlayerActions" | "PlayerPlayerActions" | "TeamActions" | "WorldActions",
  ): Promise<Action[]> {
    const allActions = await this.getGameActions(game)

    const flagField = `for_${type}` as keyof Action
    return allActions.filter((action) => action[flagField] === "1")
  }

  /**
   * Clear action cache
   */
  clearCache(): void {
    this.actionCache.clear()
    this.gameActionsCache.clear()
    this.cacheExpiry.clear()
    this.logger.debug("Action cache cleared")
  }

  /**
   * Build cache key for action lookup
   */
  private buildCacheKey(game: string, code: string, team?: string): string {
    return `${game}:${code}:${team || "any"}`
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const expiry = this.cacheExpiry.get(cacheKey)
    return expiry ? expiry > Date.now() : false
  }

  /**
   * Cache an action result
   */
  private cacheAction(cacheKey: string, action: Action | null): void {
    if (action) {
      this.actionCache.set(cacheKey, action)
    }
    this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL)
  }
}
