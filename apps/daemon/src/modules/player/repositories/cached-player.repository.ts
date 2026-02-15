/**
 * Cached Player Repository
 *
 * Extends the base player repository with intelligent caching for
 * frequently accessed player data using Garnet.
 */

import type { DatabaseClient } from "@/database/client"
import type { ICacheService } from "@/shared/infrastructure/caching"
import type { CreateOptions, FindOptions, UpdateOptions } from "@/shared/types/database"
import type { ILogger } from "@/shared/utils/logger.types"
import type { Player, PlayerCreateData } from "../types/player.types"
import { PlayerRepository } from "./player.repository"

/**
 * Player repository with automatic caching
 */
export class CachedPlayerRepository extends PlayerRepository {
  private readonly cache: ICacheService

  // Cache TTL configurations (in seconds)
  private readonly CACHE_TTL = {
    PLAYER_DATA: 3600, // 1 hour
    PLAYER_STATS: 1800, // 30 minutes
    PLAYER_LIST: 300, // 5 minutes
  } as const

  constructor(database: DatabaseClient, logger: ILogger, cache: ICacheService) {
    super(database, logger)
    this.cache = cache
  }

  /**
   * Get player by ID with caching
   */
  async findById(id: number): Promise<Player | null> {
    const cacheKey = `player:${id}`

    try {
      // Try cache first
      const cachedPlayer = await this.cache.get<Player>(cacheKey)
      if (cachedPlayer) {
        this.logger.debug("Player served from cache", { playerId: id })
        return cachedPlayer
      }
    } catch (error) {
      this.logger.warn("Cache read failed for player", {
        playerId: id,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Fallback to database
    const player = await super.findById(id)

    // Cache the result if found
    if (player) {
      try {
        await this.cache.set(cacheKey, player, this.CACHE_TTL.PLAYER_DATA)
        this.logger.debug("Player cached", { playerId: id })
      } catch (error) {
        this.logger.warn("Failed to cache player", {
          playerId: id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return player
  }

  /**
   * Get player stats with caching
   */
  async getPlayerStats(playerId: number, options?: FindOptions): Promise<Player | null> {
    const cacheKey = `player:stats:${playerId}`

    try {
      // Try cache first
      const cachedPlayer = await this.cache.get<Player>(cacheKey)
      if (cachedPlayer) {
        this.logger.debug("Player stats served from cache", { playerId })
        return cachedPlayer
      }
    } catch (error) {
      this.logger.warn("Cache read failed for player stats", {
        playerId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Fallback to database
    const stats = await super.getPlayerStats(playerId, options)

    // Cache the result if found
    if (stats) {
      try {
        await this.cache.set(cacheKey, stats, this.CACHE_TTL.PLAYER_STATS)
        this.logger.debug("Player stats cached", { playerId })
      } catch (error) {
        this.logger.warn("Failed to cache player stats", {
          playerId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return stats
  }

  /**
   * Create player and invalidate related cache
   */
  async create(data: PlayerCreateData, options?: CreateOptions): Promise<Player> {
    const player = await super.create(data, options)

    // Invalidate related caches
    await this.invalidatePlayerCaches(player.playerId)
    await this.invalidateListCaches()

    return player
  }

  /**
   * Update player and invalidate related cache
   */
  async update(id: number, data: Partial<Player>, options?: UpdateOptions): Promise<Player> {
    const player = await super.update(id, data, options)

    if (player) {
      // Invalidate related caches
      await this.invalidatePlayerCaches(id)
      await this.invalidateListCaches()
    }

    return player
  }

  /**
   * Invalidate all cache entries for a specific player
   */
  private async invalidatePlayerCaches(playerId: number): Promise<void> {
    try {
      await Promise.all([
        this.cache.del(`player:${playerId}`),
        this.cache.del(`player:stats:${playerId}`),
        this.cache.invalidatePattern(`player:${playerId}:*`),
      ])
      this.logger.debug("Player caches invalidated", { playerId })
    } catch (error) {
      this.logger.warn("Failed to invalidate player caches", {
        playerId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Invalidate list-based caches
   */
  private async invalidateListCaches(): Promise<void> {
    try {
      await this.cache.invalidatePattern("players:list:*")
      this.logger.debug("Player list caches invalidated")
    } catch (error) {
      this.logger.warn("Failed to invalidate player list caches", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Warm up cache with frequently accessed players
   */
  async warmupCache(playerIds: number[]): Promise<void> {
    this.logger.info("Warming up player cache", { playerCount: playerIds.length })

    const promises = playerIds.map(async (id) => {
      try {
        const player = await super.findById(id)
        if (player) {
          await this.cache.set(`player:${id}`, player, this.CACHE_TTL.PLAYER_DATA)
        }

        const stats = await super.getPlayerStats(id)
        if (stats) {
          await this.cache.set(`player:stats:${id}`, stats, this.CACHE_TTL.PLAYER_STATS)
        }
      } catch (error) {
        this.logger.warn("Failed to warm up cache for player", {
          playerId: id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    await Promise.allSettled(promises)
    this.logger.info("Player cache warmup completed")
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ keys: number; memory?: string }> {
    try {
      // This would need to be implemented based on the cache service capabilities
      return { keys: 0 }
    } catch (error) {
      this.logger.warn("Failed to get cache stats", {
        error: error instanceof Error ? error.message : String(error),
      })
      return { keys: 0 }
    }
  }
}
