/**
 * Player Status Enricher
 *
 * Enriches player data by updating geo location information from RCON status.
 * Extracts IP addresses from connected players and updates their geographic data.
 */

import type { GeoIPService } from "@/modules/geoip/geoip.service"
import type { IPlayerRepository } from "@/modules/player/types/player.types"
import type { PlayerInfo } from "@/modules/rcon/types/rcon.types"
import type { IServerService } from "@/modules/server/server.types"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import type { ILogger } from "@/shared/utils/logger.types"
import type { Player } from "@repo/database/client"

export interface IPlayerStatusEnricher {
  /**
   * Enrich player geo data from RCON status player list
   */
  enrichPlayerGeoData(serverId: number, playerList: PlayerInfo[]): Promise<void>
}

/**
 * Enriches player geo location data using IP addresses from RCON status
 */
export class PlayerStatusEnricher implements IPlayerStatusEnricher {
  private readonly enrichmentCache = new Map<string, { timestamp: number; processed: boolean }>()
  private readonly CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

  constructor(
    private readonly playerRepository: IPlayerRepository,
    private readonly serverService: IServerService,
    private readonly geoipService: GeoIPService,
    private readonly logger: ILogger,
  ) {}

  /**
   * Enriches player geo data from status player list
   */
  async enrichPlayerGeoData(serverId: number, playerList: PlayerInfo[]): Promise<void> {
    try {
      // Check if GeoIP enrichment is enabled for this server
      const enrichmentEnabled = await this.serverService.getServerConfigBoolean(
        serverId,
        "EnableGeoIPEnrichment",
        true,
      )

      if (!enrichmentEnabled) {
        this.logger.debug(`GeoIP enrichment disabled for server ${serverId}`)
        return
      }

      // Check if bots should be ignored
      const ignoreBots = await this.serverService.getServerConfigBoolean(
        serverId,
        "IgnoreBots",
        true,
      )

      // Filter players that need enrichment
      const playersToEnrich = this.filterPlayersForEnrichment(playerList, ignoreBots)

      if (playersToEnrich.length === 0) {
        this.logger.debug(`No players need geo enrichment on server ${serverId}`)
        return
      }

      // Get server game for player lookup
      const server = await this.serverService.findById(serverId)
      const game = server?.game || "cstrike"

      // Process players in batches to avoid overwhelming the database
      const batchSize = 5
      for (let i = 0; i < playersToEnrich.length; i += batchSize) {
        const batch = playersToEnrich.slice(i, i + batchSize)
        await this.processBatch(batch, game)
      }

      this.logger.debug(
        `Processed ${playersToEnrich.length} players for geo enrichment on server ${serverId}`,
      )
    } catch (error) {
      this.logger.warn(`Failed to enrich player geo data for server ${serverId}: ${error}`)
    }
  }

  /**
   * Filter players that need geo enrichment
   */
  private filterPlayersForEnrichment(playerList: PlayerInfo[], ignoreBots: boolean): PlayerInfo[] {
    return playerList.filter((player) => {
      // Skip bots if configured to ignore them
      if (ignoreBots && player.isBot) {
        return false
      }

      // Must have a valid IP address
      if (!player.address || player.address === "loopback") {
        return false
      }

      // Must have a valid Steam ID (not BOT)
      if (!player.uniqueid || player.uniqueid === "BOT") {
        return false
      }

      // Check cache to avoid redundant processing
      const cacheKey = `${player.uniqueid}:${player.address?.split(":")[0]}`
      const cached = this.enrichmentCache.get(cacheKey)
      const now = Date.now()

      if (cached && now - cached.timestamp < this.CACHE_TTL_MS && cached.processed) {
        return false
      }

      return true
    })
  }

  /**
   * Process a batch of players for geo enrichment
   */
  private async processBatch(players: PlayerInfo[], game: string): Promise<void> {
    const promises = players.map(async (player) => {
      try {
        await this.enrichSinglePlayer(player, game)

        // Update cache
        const cacheKey = `${player.uniqueid}:${player.address?.split(":")[0]}`
        this.enrichmentCache.set(cacheKey, {
          timestamp: Date.now(),
          processed: true,
        })
      } catch (error) {
        this.logger.warn(`Failed to enrich player ${player.name} (${player.uniqueid}): ${error}`)

        // Mark as processed to avoid retry spam, but with shorter TTL
        const cacheKey = `${player.uniqueid}:${player.address?.split(":")[0]}`
        this.enrichmentCache.set(cacheKey, {
          timestamp: Date.now() - this.CACHE_TTL_MS + 5 * 60 * 1000, // Retry in 5 minutes
          processed: true,
        })
      }
    })

    await Promise.allSettled(promises)
  }

  /**
   * Enrich a single player's geo data
   */
  private async enrichSinglePlayer(playerInfo: PlayerInfo, game: string): Promise<void> {
    // Find player by Steam ID
    const player = await this.playerRepository.findByUniqueId(playerInfo.uniqueid, game)
    if (!player) {
      this.logger.debug(`Player not found: ${playerInfo.name} (${playerInfo.uniqueid})`)
      return
    }

    // Check if player already has recent geo data for this IP
    if (player.lastAddress === playerInfo.address && this.hasRecentGeoData(player)) {
      this.logger.debug(`Player ${player.lastName} already has current geo data`)
      return
    }

    // Perform GeoIP lookup (extract IP from IP:port format)
    const ipAddress = playerInfo.address?.split(":")[0]
    if (!ipAddress) {
      this.logger.debug(`No IP address available for player ${playerInfo.name}`)
      return
    }

    const geoData = await this.performGeoIPLookup(ipAddress)
    if (!geoData) {
      this.logger.debug(`No geo data found for IP: ${ipAddress}`)
      return
    }

    // Update player geo information
    const updateBuilder = StatUpdateBuilder.create().updateGeoInfo({
      ...geoData,
      lastAddress: playerInfo.address?.split(":")[0],
    })

    await this.playerRepository.update(player.playerId, updateBuilder.build())

    this.logger.info(
      `Updated geo data for ${playerInfo.name}: ${geoData.city}, ${geoData.country} (IP: ${ipAddress})`,
    )
  }

  /**
   * Check if player has recent geo data
   */
  private hasRecentGeoData(player: Player): boolean {
    // Consider geo data recent if it exists and player has city/country
    return !!(player.city && player.country)
  }

  /**
   * Perform GeoIP lookup for an IP address
   */
  private async performGeoIPLookup(ipAddress: string): Promise<{
    city?: string
    country?: string
    flag?: string
    lat?: number
    lng?: number
  } | null> {
    try {
      const geo = await this.geoipService.lookup(ipAddress)
      if (!geo) return null

      return {
        city: geo.city,
        country: geo.country,
        flag: geo.flag,
        lat: geo.latitude,
        lng: geo.longitude,
      }
    } catch (error) {
      this.logger.warn(`GeoIP lookup failed for ${ipAddress}: ${error}`)
      return null
    }
  }

  /**
   * Clean expired cache entries
   */
  cleanCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.enrichmentCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.enrichmentCache.delete(key)
      }
    }
  }
}
