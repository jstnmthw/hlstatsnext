import type { PrismaClient } from "@repo/database/client"
import type { PlayerStatistics } from "./player.types"
import type { Result, AppError } from "@/shared/types"
import { success, failure } from "@/shared/types"

/**
 * Service class for handling player-related business logic operations
 */
export class PlayerService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get player statistics summary with rank calculation
   */
  async getPlayerStats(playerId: string): Promise<Result<PlayerStatistics, AppError>> {
    try {
      const player = await this.db.player.findUnique({
        where: { playerId: Number(playerId) },
      })

      if (!player) {
        return failure({
          type: "NOT_FOUND",
          message: "Player not found",
          resource: "player",
          id: playerId,
        })
      }

      // Calculate derived statistics
      const killDeathRatio = player.deaths > 0 ? player.kills / player.deaths : player.kills
      const accuracy = player.shots > 0 ? (player.hits / player.shots) * 100 : 0
      const headshotRatio = player.kills > 0 ? (player.headshots / player.kills) * 100 : 0

      // Get player rank within their game - complex query better in service
      const rank =
        (await this.db.player.count({
          where: {
            game: player.game,
            skill: {
              gt: player.skill,
            },
            hideranking: 0,
          },
        })) + 1

      const statistics: PlayerStatistics = {
        player,
        killDeathRatio: Math.round(killDeathRatio * 100) / 100,
        accuracy: Math.round(accuracy * 100) / 100,
        headshotRatio: Math.round(headshotRatio * 100) / 100,
        rank,
      }

      return success(statistics)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to calculate player statistics",
        operation: "getPlayerStats",
      })
    }
  }
}
