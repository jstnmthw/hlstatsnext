/**
 * Server Status Coordinator
 *
 * Centralizes all server status updates and enrichment operations.
 * Prevents duplicate database writes and ensures consistent server state.
 */

import type { ILogger } from "@/shared/utils/logger.types"
import type { IRconService, ServerStatus } from "@/modules/rcon/types/rcon.types"
import type {
  IServerRepository,
  IServerService,
  ServerStatusUpdate,
} from "@/modules/server/server.types"
import type { IPlayerStatusEnricher } from "@/modules/player/enrichers/player-status-enricher"

export interface IServerStatusCoordinator {
  /**
   * Enrich server status from RCON and update database
   */
  enrichServerStatus(serverId: number): Promise<void>

  /**
   * Update server status from cached data without RCON call
   */
  updateServerStatus(serverId: number, status: ServerStatus): Promise<void>

  /**
   * Batch update multiple servers for performance
   */
  batchEnrichServers(serverIds: number[]): Promise<void>

  /**
   * Get cached server status
   */
  getCachedServerStatus(serverId: number): ServerStatus | undefined

  /**
   * Clear server status cache
   */
  clearStatusCache(serverId?: number): void
}

/**
 * Server Status Coordinator
 *
 * Centralizes server status management to prevent redundant operations
 * and ensure consistent server state across the application.
 */
export class ServerStatusCoordinator implements IServerStatusCoordinator {
  /** Cache server status to prevent duplicate RCON calls */
  private readonly statusCache = new Map<number, { status: ServerStatus; timestamp: number }>()

  /** Track ongoing enrichment operations to prevent duplicates */
  private readonly enrichmentOperations = new Set<number>()

  /** Cache TTL in milliseconds (5 minutes) */
  private readonly cacheTimeout = 5 * 60 * 1000

  constructor(
    private readonly rconService: IRconService,
    private readonly serverRepository: IServerRepository,
    private readonly serverService: IServerService,
    private readonly logger: ILogger,
    private readonly playerStatusEnricher?: IPlayerStatusEnricher,
  ) {}

  /**
   * Enrich server status via RCON and update database
   */
  async enrichServerStatus(serverId: number): Promise<void> {
    // Check if enrichment is already in progress
    if (this.enrichmentOperations.has(serverId)) {
      this.logger.debug(`Server ${serverId} enrichment already in progress, skipping`)
      return
    }

    // Check cache first
    const cached = this.getCachedServerStatus(serverId)
    if (cached && this.isCacheValid(serverId)) {
      this.logger.debug(`Using cached status for server ${serverId}`)
      await this.updateServerStatus(serverId, cached)
      return
    }

    this.enrichmentOperations.add(serverId)

    try {
      const status = await this.fetchServerStatus(serverId)

      // Cache the status
      this.statusCache.set(serverId, {
        status,
        timestamp: Date.now(),
      })

      await this.updateServerStatus(serverId, status)

      this.logger.debug(`Enriched server ${serverId} status`, {
        serverId,
        players: `${status.players}/${status.maxPlayers}`,
        map: status.map,
        hostname: status.hostname,
      })
    } catch (error) {
      this.logger.warn(`Failed to enrich server ${serverId} status: ${error}`)
      throw error
    } finally {
      this.enrichmentOperations.delete(serverId)
    }
  }

  /**
   * Update server status from provided data without RCON call
   */
  async updateServerStatus(serverId: number, status: ServerStatus): Promise<void> {
    try {
      const update = await this.buildStatusUpdate(serverId, status)
      await this.updateServerDatabase(serverId, update, status.map)

      // Enrich player geo data if available
      if (this.playerStatusEnricher && status.playerList && status.playerList.length > 0) {
        await this.playerStatusEnricher.enrichPlayerGeoData(serverId, status.playerList)
      }

      this.logger.debug(`Updated server ${serverId} status`, {
        serverId,
        activePlayers: update.activePlayers,
        maxPlayers: update.maxPlayers,
        map: update.activeMap,
        hostname: update.hostname,
      })
    } catch (error) {
      this.logger.error(`Failed to update server ${serverId} status: ${error}`)
      throw error
    }
  }

  /**
   * Batch update multiple servers for performance
   */
  async batchEnrichServers(serverIds: number[]): Promise<void> {
    const enrichmentPromises = serverIds.map((serverId) =>
      this.enrichServerStatus(serverId).catch((error) => {
        this.logger.warn(`Failed to enrich server ${serverId} in batch: ${error}`)
        return null
      }),
    )

    const results = await Promise.allSettled(enrichmentPromises)
    const successCount = results.filter((r) => r.status === "fulfilled").length
    const errorCount = results.filter((r) => r.status === "rejected").length

    this.logger.debug(`Batch enrichment completed`, {
      total: serverIds.length,
      successful: successCount,
      errors: errorCount,
    })
  }

  /**
   * Get cached server status if valid
   */
  getCachedServerStatus(serverId: number): ServerStatus | undefined {
    const cached = this.statusCache.get(serverId)
    if (!cached || !this.isCacheValid(serverId)) {
      return undefined
    }
    return cached.status
  }

  /**
   * Clear server status cache
   */
  clearStatusCache(serverId?: number): void {
    if (serverId) {
      this.statusCache.delete(serverId)
      this.logger.debug(`Cleared status cache for server ${serverId}`)
    } else {
      this.statusCache.clear()
      this.logger.debug("Cleared all server status cache")
    }
  }

  /**
   * Fetch server status via RCON
   */
  private async fetchServerStatus(serverId: number): Promise<ServerStatus> {
    if (!this.rconService.isConnected(serverId)) {
      await this.rconService.connect(serverId)
    }

    return await this.rconService.getStatus(serverId)
  }

  /**
   * Build server status update from RCON data, respecting IgnoreBots config
   */
  private async buildStatusUpdate(
    serverId: number,
    status: ServerStatus,
  ): Promise<ServerStatusUpdate> {
    // Get IgnoreBots configuration (default to false - include bots)
    const ignoreBots = await this.serverService.getServerConfigBoolean(
      serverId,
      "IgnoreBots",
      false,
    )

    // Calculate active players based on IgnoreBots setting
    let activePlayers: number
    if (ignoreBots) {
      // Only count real players, exclude bots
      activePlayers = status.realPlayerCount ?? status.players
    } else {
      // Count all players (real + bots)
      activePlayers = status.players
    }

    return {
      activePlayers,
      maxPlayers: status.maxPlayers,
      activeMap: status.map,
      hostname: status.hostname,
    }
  }

  /**
   * Update server database with status information
   */
  private async updateServerDatabase(
    serverId: number,
    update: ServerStatusUpdate,
    currentMap: string,
  ): Promise<void> {
    // Check if map changed to reset map statistics
    const existingServer = await this.serverService.findById(serverId)
    if (existingServer && existingServer.activeMap !== currentMap) {
      this.logger.info(
        `Map changed for server ${serverId}: ${existingServer.activeMap} -> ${currentMap}`,
      )

      // Reset map statistics when map changes
      await this.serverRepository.resetMapStats(serverId, currentMap)
    }

    // Update server status in database
    await this.serverRepository.updateServerStatusFromRcon(serverId, update)
  }

  /**
   * Check if cached status is still valid
   */
  private isCacheValid(serverId: number): boolean {
    const cached = this.statusCache.get(serverId)
    if (!cached) {
      return false
    }

    return Date.now() - cached.timestamp < this.cacheTimeout
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [serverId, cached] of this.statusCache.entries()) {
      if (now - cached.timestamp >= this.cacheTimeout) {
        this.statusCache.delete(serverId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`)
    }
  }

  /**
   * Start periodic cache cleanup
   */
  startCacheCleanup(): void {
    // Clean up expired cache every 10 minutes
    setInterval(
      () => {
        this.cleanupExpiredCache()
      },
      10 * 60 * 1000,
    )

    this.logger.debug("Started server status cache cleanup")
  }

  /**
   * Get coordinator statistics
   */
  getStats(): {
    cacheSize: number
    ongoingEnrichments: number
    cacheHitRate?: number
  } {
    return {
      cacheSize: this.statusCache.size,
      ongoingEnrichments: this.enrichmentOperations.size,
    }
  }
}
