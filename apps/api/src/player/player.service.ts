import type { Player, PrismaClient } from "@repo/database/client"
import type { PlayerStatistics, CreatePlayerInput, UpdatePlayerStatsInput } from "../types/database/player.types"
import type { Result, AppError } from "../types/common"
import { success, failure } from "../types/common"

/**
 * Service class for handling player-related business logic operations
 *
 * Note: Basic CRUD operations (getPlayer, getPlayers, getTopPlayers, getPlayerBySteamId)
 * are now handled directly by GraphQL resolvers for better performance and consistency.
 * This service focuses on complex business logic and operations requiring transaction handling.
 */
export class PlayerService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Get player statistics summary with rank calculation
   * This involves complex business logic that's better handled in the service layer
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

  /**
   * Update player statistics (called by daemon)
   * Requires transaction handling and complex business logic
   */
  async updatePlayerStats(
    steamId: string,
    gameId: string,
    stats: UpdatePlayerStatsInput,
  ): Promise<Result<Player, AppError>> {
    try {
      // Find player by Steam ID - complex relation query
      const existingPlayer = await this.db.player.findFirst({
        where: {
          uniqueIds: {
            some: {
              uniqueId: steamId,
              game: gameId,
            },
          },
        },
      })

      if (!existingPlayer) {
        return failure({
          type: "NOT_FOUND",
          message: "Player not found",
          resource: "player",
          id: steamId,
        })
      }

      // Update player statistics with proper data validation
      const updatedPlayer = await this.db.player.update({
        where: { playerId: existingPlayer.playerId },
        data: {
          ...(stats.kills !== undefined && { kills: stats.kills }),
          ...(stats.deaths !== undefined && { deaths: stats.deaths }),
          ...(stats.suicides !== undefined && { suicides: stats.suicides }),
          ...(stats.shots !== undefined && { shots: stats.shots }),
          ...(stats.hits !== undefined && { hits: stats.hits }),
          ...(stats.headshots !== undefined && { headshots: stats.headshots }),
          ...(stats.teamkills !== undefined && { teamkills: stats.teamkills }),
          ...(stats.skill !== undefined && { skill: stats.skill }),
          ...(stats.connectionTime !== undefined && {
            connection_time: stats.connectionTime,
          }),
          ...(stats.lastEvent !== undefined && { last_event: stats.lastEvent }),
        },
      })

      return success(updatedPlayer)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to update player statistics",
        operation: "updatePlayerStats",
      })
    }
  }

  /**
   * Create a new player with Steam ID association
   * Requires transaction to ensure data consistency across tables
   */
  async createPlayer(data: CreatePlayerInput): Promise<Result<Player, AppError>> {
    try {
      const player = await this.db.player.create({
        data: {
          lastName: data.lastName,
          game: data.gameId,
          fullName: data.fullName,
          email: data.email,
          homepage: data.homepage,
          clan: data.clanId ? Number(data.clanId) : undefined,
          flag: data.countryId,
          city: data.city,
          state: data.state,
          lastAddress: data.lastAddress,
          uniqueIds: {
            create: {
              uniqueId: data.steamId,
              game: data.gameId,
            },
          },
        },
      })

      return success(player)
    } catch (error) {
      console.error(error)
      return failure({
        type: "DATABASE_ERROR",
        message: "Failed to create player",
        operation: "createPlayer",
      })
    }
  }
}
