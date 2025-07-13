import { DatabaseClient, databaseClient as defaultDb } from "@/database/client"
import type { SkillRating } from "@/services/processor/handlers/ranking.handler"
import type { ILogger } from "@/utils/logger.types"
import { logger as defaultLogger } from "@/utils/logger"
import type { Player } from "@repo/database/client"
import type { IPlayerService } from "./player.types"

/**
 * Player Service for Daemon v2
 *
 * Handles all player-related operations including:
 * - Player ratings and skill tracking
 * - Player statistics updates
 * - Player lookup and creation
 */
export class PlayerService implements IPlayerService {
  // Rating system constants
  private readonly DEFAULT_RATING = 1000
  private readonly DEFAULT_CONFIDENCE = 350
  private readonly DEFAULT_VOLATILITY = 0.06
  private readonly MAX_CONFIDENCE_REDUCTION = 300
  private readonly UNIX_TIMESTAMP_DIVISOR = 1000

  constructor(
    private readonly db: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  /**
   * Get a player's current skill rating and stats
   */
  async getPlayerRating(playerId: number): Promise<SkillRating> {
    try {
      // Get player data from database
      const player = await this.db.prisma.player.findUnique({
        where: { playerId },
        select: {
          skill: true,
          _count: {
            select: {
              fragsAsKiller: true, // Use frags as a proxy for games played
            },
          },
        },
      })

      if (!player) {
        // Return default rating for new players
        return {
          playerId,
          rating: this.DEFAULT_RATING,
          confidence: this.DEFAULT_CONFIDENCE,
          volatility: this.DEFAULT_VOLATILITY,
          gamesPlayed: 0,
        }
      }

      // Confidence decreases with experience (more games = more confident rating)
      const confidenceReduction = Math.min(
        player._count.fragsAsKiller,
        this.MAX_CONFIDENCE_REDUCTION,
      )
      const adjustedConfidence = this.DEFAULT_CONFIDENCE - confidenceReduction

      return {
        playerId,
        rating: player.skill,
        confidence: adjustedConfidence,
        volatility: this.DEFAULT_VOLATILITY,
        gamesPlayed: player._count.fragsAsKiller,
      }
    } catch (error) {
      this.logger.error(`Failed to get player rating for ${playerId}: ${error as string}`)
      // Return default rating on error
      return {
        playerId,
        rating: this.DEFAULT_RATING,
        confidence: this.DEFAULT_CONFIDENCE,
        volatility: this.DEFAULT_VOLATILITY,
        gamesPlayed: 0,
      }
    }
  }

  /**
   * Update player ratings in a transaction
   */
  async updatePlayerRatings(
    updates: Array<{ playerId: number; newRating: number; gamesPlayed: number }>,
  ): Promise<void> {
    try {
      // Update all players in a transaction
      await this.db.transaction(async (tx) => {
        await Promise.all(
          updates.map((update) =>
            tx.player.update({
              where: { playerId: update.playerId },
              data: {
                skill: update.newRating,
                last_skill_change: Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR),
              },
            }),
          ),
        )
      })
    } catch (error) {
      this.logger.error(`Failed to update player ratings: ${error as string}`)
      throw error
    }
  }

  /**
   * Get all players who participated in a round
   */
  async getRoundParticipants(serverId: number, duration: number) {
    try {
      const durationMs = duration * this.UNIX_TIMESTAMP_DIVISOR
      const roundStartTime = new Date(Date.now() - durationMs)

      return await this.db.prisma.eventEntry.findMany({
        where: {
          serverId,
          eventTime: {
            gte: roundStartTime,
          },
        },
        select: {
          playerId: true,
          player: {
            select: {
              skill: true,
              teamkills: true,
              kills: true,
              deaths: true,
            },
          },
        },
      })
    } catch (error) {
      this.logger.error(`Failed to get round participants: ${error as string}`)
      throw error
    }
  }

  /**
   * Get or create a player by Steam ID
   */
  async getOrCreatePlayer(steamId: string, playerName: string, game: string): Promise<number> {
    const isBot = steamId.toUpperCase() === "BOT"
    const normalizedName = playerName
      .trim()
      .replace(/\s+/g, "_") // Spaces → underscores
      .replace(/[^A-Za-z0-9_-]/g, "") // Remove exotic chars
      .substring(0, 48) // Leave room for "BOT_" prefix within 64-char limit

    const effectiveId = isBot ? `BOT_${normalizedName}` : steamId

    try {
      // First, try to find existing player by Steam ID
      const uniqueId = await this.db.prisma.playerUniqueId.findUnique({
        where: {
          uniqueId_game: {
            uniqueId: effectiveId,
            game: game,
          },
        },
        include: {
          player: true,
        },
      })

      if (uniqueId) {
        return uniqueId.playerId
      }

      // Create new player
      const player = await this.db.prisma.player.create({
        data: {
          lastName: playerName,
          game: game,
          skill: 1000, // Default skill rating
          uniqueIds: {
            create: {
              uniqueId: effectiveId,
              game: game,
            },
          },
        },
      })

      return player.playerId
    } catch (error) {
      this.logger.error(`Failed to get or create player: ${error as string}`)
      throw error
    }
  }

  /**
   * Update player statistics
   */
  async updatePlayerStats(
    playerId: number,
    updates: {
      kills?: number
      deaths?: number
      suicides?: number
      teamkills?: number
      skill?: number
      shots?: number
      hits?: number
      headshots?: number
      kill_streak?: number
      death_streak?: number
      connection_time?: number
    },
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {}

      if (updates.kills !== undefined) {
        updateData.kills = { increment: updates.kills }
      }
      if (updates.deaths !== undefined) {
        updateData.deaths = { increment: updates.deaths }
      }
      if (updates.suicides !== undefined) {
        updateData.suicides = { increment: updates.suicides }
      }
      if (updates.teamkills !== undefined) {
        updateData.teamkills = { increment: updates.teamkills }
      }
      if (updates.skill !== undefined) {
        updateData.skill = updates.skill
      }
      if (updates.shots !== undefined) {
        updateData.shots = { increment: updates.shots }
      }
      if (updates.hits !== undefined) {
        updateData.hits = { increment: updates.hits }
      }
      if (updates.headshots !== undefined) {
        updateData.headshots = { increment: updates.headshots }
      }
      if (updates.kill_streak !== undefined) {
        updateData.kill_streak = updates.kill_streak
      }
      if (updates.death_streak !== undefined) {
        updateData.death_streak = updates.death_streak
      }
      if (updates.connection_time !== undefined) {
        updateData.connection_time = { increment: updates.connection_time }
      }

      await this.db.prisma.player.update({
        where: { playerId },
        data: updateData,
      })
    } catch (error) {
      this.logger.error(`Failed to update player stats for ${playerId}: ${error as string}`)
      throw error
    }
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(playerId: number): Promise<Player | null> {
    try {
      const player = await this.db.prisma.player.findUnique({
        where: { playerId },
      })

      return player
    } catch (error) {
      this.logger.error(`Failed to get player stats for ${playerId}: ${error as string}`)
      return null
    }
  }

  /**
   * Get top players by skill ranking
   * @param limit Number of players to return (default 50)
   * @param game Game code to filter by
   * @param includeHidden Whether to include players with hideranking set
   */
  async getTopPlayers(
    limit: number = 50,
    game: string = "cstrike",
    includeHidden: boolean = false,
  ): Promise<Player[]> {
    try {
      const whereClause: Record<string, unknown> = {
        game,
      }

      if (!includeHidden) {
        whereClause.hideranking = 0
      }

      const players = await this.db.prisma.player.findMany({
        where: whereClause,
        orderBy: {
          skill: "desc",
        },
        take: Math.min(limit, 100),
      })

      return players
    } catch (error) {
      this.logger.error(`Failed to get top players: ${error as string}`)
      return []
    }
  }
}

/**
 * Factory function for creating a PlayerService instance
 */
export function createPlayerService(
  databaseClient: DatabaseClient = defaultDb,
  logger: ILogger = defaultLogger,
): IPlayerService {
  return new PlayerService(databaseClient, logger)
}
