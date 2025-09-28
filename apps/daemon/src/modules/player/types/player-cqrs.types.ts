/**
 * Player CQRS Types
 *
 * Commands and queries for player operations.
 */

import { BaseCommand, BaseQuery } from "@/shared/application/cqrs/command.types"

// ========================================
// Commands (Write Operations)
// ========================================

/**
 * Update Player Stats Command
 */
export class UpdatePlayerStatsCommand extends BaseCommand {
  constructor(
    public readonly playerId: number,
    public readonly stats: {
      kills?: number
      deaths?: number
      headshots?: number
      damage?: number
      skill?: number
    },
    public readonly serverId: number,
    commandId?: string,
  ) {
    super(commandId)
  }
}

// ========================================
// Queries (Read Operations)
// ========================================

/**
 * Get Player Stats Query
 */
export class GetPlayerStatsQuery extends BaseQuery {
  constructor(
    public readonly playerId: number,
    public readonly serverId?: number,
    public readonly cacheTtl: number = 2 * 60 * 1000, // 2 minutes default cache
    queryId?: string,
  ) {
    super(queryId)
  }
}

/**
 * Get Player Stats Query Result
 */
export interface PlayerStatsResult {
  playerId: number
  serverId?: number
  stats: {
    kills: number
    deaths: number
    headshots: number
    skill: number
    [key: string]: number
  }
  lastUpdated: Date
}
