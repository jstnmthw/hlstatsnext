import type { Action } from "@repo/database/client"

export interface IActionService {
  /**
   * Get action definition by game and code
   */
  getAction(game: string, code: string, team?: string): Promise<Action | null>

  /**
   * Get all actions for a specific game
   */
  getGameActions(game: string): Promise<Action[]>

  /**
   * Check if an action exists for player actions (for_PlayerActions = '1')
   */
  isPlayerAction(game: string, code: string, team?: string): Promise<boolean>

  /**
   * Check if an action exists for player-player actions (for_PlayerPlayerActions = '1')
   */
  isPlayerPlayerAction(game: string, code: string, team?: string): Promise<boolean>

  /**
   * Check if an action exists for team actions (for_TeamActions = '1')
   */
  isTeamAction(game: string, code: string, team?: string): Promise<boolean>

  /**
   * Get actions by type flags
   */
  getActionsByType(
    game: string, 
    type: 'PlayerActions' | 'PlayerPlayerActions' | 'TeamActions' | 'WorldActions'
  ): Promise<Action[]>

  /**
   * Clear action cache (useful for development/testing)
   */
  clearCache(): void
}

export interface ActionLookupKey {
  game: string
  code: string
  team?: string
}

export interface ActionStats {
  playerId: number
  actionId: number
  count: number
  totalBonus: number
  lastPerformed: Date
}