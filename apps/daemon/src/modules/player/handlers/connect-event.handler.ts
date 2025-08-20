/**
 * Player Connect Event Handler
 *
 * Handles player connection events including GeoIP enrichment,
 * server stats updates, and player name tracking.
 */

import { BasePlayerEventHandler } from "./base-player-event.handler"
import { EventType } from "@/shared/types/events"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import { PlayerNameUpdateBuilder } from "@/shared/application/utils/player-name-update.builder"
import type { HandlerResult } from "@/shared/types/common"
import type { PlayerEvent, PlayerConnectEvent } from "@/modules/player/player.types"
import type { PlayerMeta } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"

export class ConnectEventHandler extends BasePlayerEventHandler {
  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    matchService?: IMatchService,
    private readonly geoipService?: { lookup(ipWithPort: string): Promise<unknown | null> },
  ) {
    super(repository, logger, matchService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_CONNECT) {
        return this.createErrorResult("Invalid event type for ConnectEventHandler")
      }

      const connectEvent = event as PlayerConnectEvent
      const { playerId, ipAddress } = connectEvent.data

      // Build player stats update with GeoIP enrichment
      const updateBuilder = StatUpdateBuilder.create().updateLastEvent()

      // Attempt GeoIP enrichment
      if (this.geoipService && ipAddress) {
        const geoData = await this.performGeoIPLookup(ipAddress)
        if (geoData) {
          updateBuilder.updateGeoInfo(geoData)
        }
      }

      // Update player stats
      await this.repository.update(playerId, updateBuilder.build())

      // Update player name usage
      await this.updatePlayerNameUsage(playerId, event.meta as PlayerMeta)

      // Update server stats
      await this.updateServerStats(event.serverId)

      // Create connect event log
      await this.createConnectEventLog(playerId, event.serverId, ipAddress || "")

      this.logger.debug(`Player connected: ${playerId}`)

      return this.createSuccessResult()
    })
  }

  /**
   * Perform GeoIP lookup and format data
   */
  private async performGeoIPLookup(ipAddress: string): Promise<{
    city?: string
    country?: string
    flag?: string
    lat?: number
    lng?: number
    lastAddress?: string
  } | null> {
    try {
      if (!this.geoipService) return null

      const geo = (await this.geoipService.lookup(ipAddress)) as {
        city?: string
        country?: string
        latitude?: number
        longitude?: number
        flag?: string
      } | null

      if (!geo) return null

      return {
        city: geo.city ?? undefined,
        country: geo.country ?? undefined,
        flag: geo.flag ?? undefined,
        lat: geo.latitude ?? undefined,
        lng: geo.longitude ?? undefined,
        lastAddress: ipAddress.split(":")[0],
      }
    } catch (error) {
      this.logger.warn(`GeoIP lookup failed for ${ipAddress}: ${error}`)
      return null
    }
  }

  /**
   * Update player name usage statistics
   */
  private async updatePlayerNameUsage(playerId: number, meta?: PlayerMeta): Promise<void> {
    try {
      const currentName = meta?.playerName
      if (currentName) {
        const nameUpdate = PlayerNameUpdateBuilder.forConnect()
        await this.repository.upsertPlayerName(playerId, currentName, nameUpdate.build())
      }
    } catch (error) {
      this.logger.warn(`Failed to update player name on connect for ${playerId}: ${error}`)
    }
  }

  /**
   * Update server active players count
   */
  private async updateServerStats(serverId: number): Promise<void> {
    try {
      await this.repository.updateServerForPlayerEvent?.(serverId, {
        activePlayers: { increment: 1 },
        lastEvent: new Date(),
      })
    } catch (error) {
      this.logger.warn(`Failed to update server stats for connect on server ${serverId}: ${error}`)
    }
  }

  /**
   * Create connect event log entry
   */
  private async createConnectEventLog(
    playerId: number,
    serverId: number,
    ipAddress: string,
  ): Promise<void> {
    try {
      const map = await this.getCurrentMap(serverId)

      // Avoid duplicate connect if a connect was just recorded
      const hasRecent = await this.repository.hasRecentConnect?.(serverId, playerId, 120000)
      if (!hasRecent) {
        await this.repository.createConnectEvent(playerId, serverId, map, ipAddress)
      }
    } catch (error) {
      this.logger.warn(`Failed to create connect event log for player ${playerId}: ${error}`)
    }
  }
}
