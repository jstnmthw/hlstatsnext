import type { DatabaseClient } from "@/database/client"
import type { SkillRating } from "@/services/processor/handlers/ranking.handler"
import { logger } from "@/utils/logger"

/**
 * Player Service for Daemon v2
 *
 * Handles all player-related operations including:
 * - Player ratings and skill tracking
 * - Player statistics updates
 * - Player lookup and creation
 */
export class PlayerService {
  // Rating system constants
  private readonly DEFAULT_RATING = 1000
  private readonly DEFAULT_CONFIDENCE = 350
  private readonly DEFAULT_VOLATILITY = 0.06
  private readonly MAX_CONFIDENCE_REDUCTION = 300
  private readonly UNIX_TIMESTAMP_DIVISOR = 1000

  constructor(private readonly db: DatabaseClient) {}

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
      const confidenceReduction = Math.min(player._count.fragsAsKiller, this.MAX_CONFIDENCE_REDUCTION)
      const adjustedConfidence = this.DEFAULT_CONFIDENCE - confidenceReduction

      return {
        playerId,
        rating: player.skill,
        confidence: adjustedConfidence,
        volatility: this.DEFAULT_VOLATILITY,
        gamesPlayed: player._count.fragsAsKiller,
      }
    } catch (error) {
      logger.error(`Failed to get player rating for ${playerId}: ${error}`)
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
      logger.error(`Failed to update player ratings: ${error}`)
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
      logger.error(`Failed to get round participants: ${error}`)
      throw error
    }
  }

  /**
   * Get or create a player by Steam ID
   */
  async getOrCreatePlayer(steamId: string, playerName: string, game: string): Promise<number> {
    return this.db.getOrCreatePlayer(steamId, playerName, game)
  }

  /**
   * Update player statistics
   */
  async updatePlayerStats(
    playerId: number,
    stats: Partial<{
      kills: number
      deaths: number
      headshots: number
      shots: number
      hits: number
      suicides: number
      teamkills: number
    }>,
  ): Promise<void> {
    try {
      await this.db.prisma.player.update({
        where: { playerId },
        data: {
          ...stats,
          last_event: Math.floor(Date.now() / this.UNIX_TIMESTAMP_DIVISOR),
        },
      })
    } catch (error) {
      logger.error(`Failed to update player stats for ${playerId}: ${error}`)
      throw error
    }
  }
}
