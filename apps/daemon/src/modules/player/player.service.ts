/**
 * Player Service
 *
 * Business logic for player management, statistics, and ratings.
 */

import type {
  IPlayerService,
  IPlayerRepository,
  PlayerStatsUpdate,
  SkillRating,
  RatingUpdate,
  PlayerEvent,
  PlayerWithCounts,
} from "./player.types"
import type { IPlayerSessionService } from "./types/player-session.types"
import type { Player } from "@repo/database/client"
import type { ILogger } from "@/shared/utils/logger.types"
import type { HandlerResult } from "@/shared/types/common"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IServerRepository, IServerService } from "@/modules/server/server.types"
import { normalizeSteamId, validatePlayerName, sanitizePlayerName } from "@/shared/utils/validation"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import { PlayerEventHandlerFactory } from "./handlers/player-event-handler.factory"
import type { PlayerNotificationService } from "@/modules/rcon/services/player-notification.service"

export class PlayerService implements IPlayerService {
  private readonly DEFAULT_RATING = 1000
  private readonly DEFAULT_CONFIDENCE = 350
  private readonly DEFAULT_VOLATILITY = 0.06
  private readonly MAX_CONFIDENCE_REDUCTION = 300

  // Request-level cache for player resolution to prevent race conditions
  private readonly playerResolutionCache = new Map<string, Promise<number>>()

  // Event handler factory for delegating to specific handlers (lazy initialized)
  private eventHandlerFactory?: PlayerEventHandlerFactory

  constructor(
    private readonly repository: IPlayerRepository,
    private readonly logger: ILogger,
    private readonly rankingService: IRankingService,
    private readonly serverRepository: IServerRepository,
    private readonly serverService: IServerService,
    private readonly sessionService: IPlayerSessionService,
    private readonly matchService?: IMatchService,
    private readonly geoipService?: { lookup(ipWithPort: string): Promise<unknown | null> },
    private readonly playerNotificationService?: PlayerNotificationService,
  ) {
    // Event handler factory will be initialized lazily when first needed
  }

  /**
   * Get or initialize the event handler factory
   */
  private getEventHandlerFactory(): PlayerEventHandlerFactory {
    if (!this.eventHandlerFactory) {
      this.eventHandlerFactory = new PlayerEventHandlerFactory(
        this.repository,
        this.logger,
        this.rankingService,
        this.serverRepository,
        this.serverService,
        this.sessionService,
        this,
        this.matchService,
        this.geoipService,
        this.playerNotificationService,
      )
    }
    return this.eventHandlerFactory
  }

  async getOrCreatePlayer(steamId: string, playerName: string, game: string): Promise<number> {
    const normalized = normalizeSteamId(steamId)
    if (!normalized) {
      throw new Error(`Invalid Steam ID: ${steamId}`)
    }

    if (!validatePlayerName(playerName)) {
      throw new Error(`Invalid player name: ${playerName}`)
    }

    const isBot = normalized.toUpperCase() === "BOT"
    const normalizedName = sanitizePlayerName(playerName)
    const effectiveId = isBot ? `BOT_${normalizedName}` : normalized

    // Create cache key to prevent concurrent calls for the same player
    const cacheKey = `${effectiveId}:${game}`

    // Check if there's already a pending resolution for this player
    const existingPromise = this.playerResolutionCache.get(cacheKey)
    if (existingPromise) {
      this.logger.debug(`Using cached player resolution for ${effectiveId}`)
      return existingPromise
    }

    // Create new resolution promise and cache it
    const resolutionPromise = this._performPlayerResolution(effectiveId, playerName, game)
    this.playerResolutionCache.set(cacheKey, resolutionPromise)

    try {
      const playerId = await resolutionPromise
      // Clean up cache after successful resolution (optional: could keep for short time)
      setTimeout(() => this.playerResolutionCache.delete(cacheKey), 1000)
      return playerId
    } catch (error) {
      // Remove failed promise from cache so it can be retried
      this.playerResolutionCache.delete(cacheKey)
      throw error
    }
  }

  private async _performPlayerResolution(
    effectiveId: string,
    playerName: string,
    game: string,
  ): Promise<number> {
    try {
      // Use database-level upsert to eliminate race conditions
      const player = await this.repository.upsertPlayer({
        lastName: playerName,
        game,
        skill: this.DEFAULT_RATING,
        steamId: effectiveId,
      })

      this.logger.debug(
        `Player resolved: ${playerName} (${effectiveId}) with ID ${player.playerId}`,
      )
      return player.playerId
    } catch (error) {
      this.logger.error(`Failed to upsert player ${playerName}: ${error}`)
      throw error
    }
  }

  async getPlayerStats(playerId: number): Promise<Player | null> {
    try {
      return await this.repository.findById(playerId)
    } catch (error) {
      this.logger.error(`Failed to get player stats for ${playerId}: ${error}`)
      return null
    }
  }

  async updatePlayerStats(playerId: number, updates: PlayerStatsUpdate): Promise<void> {
    try {
      // Use StatUpdateBuilder to create the update data
      const builder = StatUpdateBuilder.create()

      // Add incremental updates
      if (updates.kills !== undefined) builder.addKills(updates.kills)
      if (updates.deaths !== undefined) builder.addDeaths(updates.deaths)
      if (updates.suicides !== undefined) builder.addSuicides(updates.suicides)
      if (updates.teamkills !== undefined) builder.addTeamkills(updates.teamkills)
      if (updates.skill !== undefined) builder.addSkillChange(updates.skill)
      if (updates.shots !== undefined) builder.addShots(updates.shots)
      if (updates.hits !== undefined) builder.addHits(updates.hits)
      if (updates.headshots !== undefined) builder.addHeadshots(updates.headshots)
      if (updates.connectionTime !== undefined) builder.addConnectionTime(updates.connectionTime)

      // Add direct value updates
      if (updates.killStreak !== undefined) builder.setKillStreak(updates.killStreak)
      if (updates.deathStreak !== undefined) builder.setDeathStreak(updates.deathStreak)
      if (updates.lastEvent !== undefined) builder.updateLastEvent(updates.lastEvent)
      if (updates.lastName !== undefined) builder.updateLastName(updates.lastName)

      if (!builder.hasUpdates()) {
        this.logger.debug(`No valid updates provided for player ${playerId}`)
        return
      }

      await this.repository.update(playerId, builder.build())
      this.logger.debug(`Updated player stats for ${playerId}`)
    } catch (error) {
      this.logger.error(`Failed to update player stats for ${playerId}: ${error}`)
      throw error
    }
  }

  async getPlayerRating(playerId: number): Promise<SkillRating> {
    try {
      const player = (await this.repository.findById(playerId, {
        select: {
          skill: true,
          _count: {
            select: {
              fragsAsKiller: true,
            },
          },
        },
      })) as PlayerWithCounts | null

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
      this.logger.error(`Failed to get player rating for ${playerId}: ${error}`)
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

  async updatePlayerRatings(updates: RatingUpdate[]): Promise<void> {
    try {
      // Update all players in a transaction
      await Promise.all(
        updates.map((update) =>
          this.repository.update(update.playerId, {
            skill: update.newRating,
            lastSkillChange: new Date(),
          }),
        ),
      )

      this.logger.debug(`Updated ratings for ${updates.length} players`)
    } catch (error) {
      this.logger.error(`Failed to update player ratings: ${error}`)
      throw error
    }
  }

  async handlePlayerEvent(event: PlayerEvent): Promise<HandlerResult> {
    try {
      // Use the event handler factory to get the appropriate handler
      const handler = this.getEventHandlerFactory().getHandler(event.eventType)

      if (!handler) {
        this.logger.debug(`PlayerService: Unhandled event type: ${event.eventType}`)
        return { success: true } // Event not handled by this service
      }

      return await handler.handle(event)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // Batch operations for performance optimization

  async getPlayerStatsBatch(playerIds: number[]): Promise<Map<number, Player>> {
    try {
      return await this.repository.getPlayerStatsBatch(playerIds)
    } catch (error) {
      this.logger.error(`Failed to batch get player stats: ${error}`)
      return new Map() // Return empty map on error
    }
  }

  async updatePlayerStatsBatch(
    updates: Array<{ playerId: number; skillDelta: number }>,
  ): Promise<void> {
    try {
      if (updates.length === 0) {
        return
      }

      await this.repository.updatePlayerStatsBatch(updates)
      this.logger.debug(`Batch updated stats for ${updates.length} players`)
    } catch (error) {
      this.logger.error(`Failed to batch update player stats: ${error}`)
      throw error
    }
  }
}
