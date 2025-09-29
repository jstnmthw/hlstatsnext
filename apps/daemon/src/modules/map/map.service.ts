/**
 * Map Service
 *
 * Centralized map tracking service that uses RCON as the single source of truth
 * for current map information. Provides caching and fallback mechanisms.
 *
 * ## Map Tracking Architecture
 *
 * This service is the authoritative source for map data and works alongside ServerStateManager:
 *
 * **MapService (this service)**: Authoritative source of current map via RCON
 *   - Single source of truth for current map data
 *   - Handles all map change logging with proper messaging:
 *     - "Map added for server X: mapname" (when previousMap is undefined)
 *     - "Map changed for server X: oldmap → newmap" (when both exist)
 *   - Provides 30-second caching to prevent RCON spam
 *   - Falls back to database for last known map if RCON fails
 *
 * **ServerStateManager**: Tracks parser context during log processing
 *   - Maintains state for parsing context (rounds, teams, maps)
 *   - No logging (handled by this service)
 *   - Used by parsers to understand game state context
 */

import type { IRconService } from "@/modules/rcon/types/rcon.types"
import type { IMatchRepository } from "@/modules/match/match.types"
import type { ILogger } from "@/shared/utils/logger.types"

export interface IMapService {
  getCurrentMap(serverId: number): Promise<string>
  getLastKnownMap(serverId: number): Promise<string | null>
  handleMapChange(serverId: number, newMap: string, previousMap?: string): Promise<void>
}

export class MapService implements IMapService {
  // Short-lived cache (30 seconds) to prevent RCON spam
  private mapCache = new Map<number, { map: string; timestamp: number }>()
  private readonly CACHE_TTL = 30000 // 30 seconds

  constructor(
    private readonly rconService: IRconService,
    private readonly matchRepository: IMatchRepository,
    private readonly logger: ILogger,
  ) {}

  /**
   * Get current map from RCON (source of truth) with caching
   */
  async getCurrentMap(serverId: number): Promise<string> {
    // Check cache first
    const cached = this.mapCache.get(serverId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.map
    }

    try {
      // RCON is source of truth
      const status = await this.rconService.getStatus(serverId)
      const currentMap = status.map || "unknown"

      // Update cache
      this.mapCache.set(serverId, {
        map: currentMap,
        timestamp: Date.now(),
      })

      return currentMap
    } catch {
      // Fallback to last known map from DB
      const lastKnown = await this.getLastKnownMap(serverId)
      return lastKnown || "unknown"
    }
  }

  /**
   * Get last known map from database (fallback)
   */
  async getLastKnownMap(serverId: number): Promise<string | null> {
    return await this.matchRepository.getLastKnownMap(serverId)
  }

  /**
   * Handle map change events (from logs)
   */
  async handleMapChange(serverId: number, newMap: string, previousMap?: string): Promise<void> {
    // Clear cache to force fresh RCON query
    this.mapCache.delete(serverId)

    // Log map change with better messaging
    if (previousMap === undefined) {
      this.logger.info(`Map added for server ${serverId}: ${newMap}`)
    } else if (previousMap !== newMap) {
      this.logger.info(`Map changed for server ${serverId}: ${previousMap} → ${newMap}`)
    }
  }
}
