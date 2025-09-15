/**
 * Player Connect Event Handler
 *
 * Handles player connection events including session creation, GeoIP enrichment,
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
import type { IPlayerRepository, IPlayerService } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IServerService } from "@/modules/server/server.types"
import type { IEventNotificationService } from "@/modules/rcon/services/event-notification.service"

export class ConnectEventHandler extends BasePlayerEventHandler {
  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    private readonly sessionService: IPlayerSessionService,
    private readonly playerService: IPlayerService,
    private readonly serverService: IServerService,
    matchService?: IMatchService,
    private readonly geoipService?: { lookup(ipWithPort: string): Promise<unknown | null> },
    private readonly eventNotificationService?: IEventNotificationService,
  ) {
    super(repository, logger, matchService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_CONNECT) {
        return this.createErrorResult("Invalid event type for ConnectEventHandler")
      }

      const connectEvent = event as PlayerConnectEvent
      const { gameUserId, playerId, steamId, ipAddress } = connectEvent.data
      const meta = event.meta as PlayerMeta

      this.logger.info(`Processing PLAYER_CONNECT`, {
        serverId: event.serverId,
        gameUserId,
        playerId,
        steamId,
        playerName: meta?.playerName,
        isBot: meta?.isBot,
        ipAddress,
      })

      // Check IgnoreBots configuration
      const ignoreBots = await this.serverService.getServerConfigBoolean(
        event.serverId,
        "IgnoreBots",
        true,
      )

      // Skip bot session creation if IgnoreBots=true
      if (ignoreBots && meta.isBot) {
        this.logger.debug(`Not creating session for bot ${meta.playerName} (IgnoreBots=true)`)
        return this.createSuccessResult()
      }

      // Use the resolved database player ID from the PlayerEventHandler
      if (playerId === undefined) {
        return this.createErrorResult("playerId not resolved by PlayerEventHandler")
      }
      const databasePlayerId = playerId

      // Create player session using the original gameUserId
      if (gameUserId !== undefined) {
        this.logger.info(`Creating session for PLAYER_CONNECT`, {
          serverId: event.serverId,
          gameUserId,
          databasePlayerId,
          steamId,
          playerName: meta.playerName,
          isBot: meta.isBot,
        })

        await this.sessionService.createSession({
          serverId: event.serverId,
          gameUserId,
          databasePlayerId,
          steamId,
          playerName: meta.playerName,
          isBot: meta.isBot,
        })

        this.logger.info(`Session created successfully for PLAYER_CONNECT`, {
          serverId: event.serverId,
          gameUserId,
          databasePlayerId,
          playerName: meta.playerName,
        })
      } else {
        this.logger.warn(`Cannot create session - no gameUserId provided`, {
          serverId: event.serverId,
          playerId,
          steamId,
          playerName: meta.playerName,
        })
      }

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
      await this.repository.update(databasePlayerId, updateBuilder.build())

      // Update player name usage
      await this.updatePlayerNameUsage(databasePlayerId, meta)

      // Update server stats
      await this.updateServerStats(event.serverId)

      // Create connect event log
      await this.createConnectEventLog(databasePlayerId, event.serverId, ipAddress || "")

      // Send connect notification
      await this.sendConnectNotification(event, databasePlayerId, ipAddress)

      this.logger.debug(
        `Player ${meta.playerName} connected: gameUserId=${gameUserId}, databasePlayerId=${databasePlayerId}`,
      )

      return this.createSuccessResult()
    })
  }

  /**
   * Send connect event notification
   */
  private async sendConnectNotification(
    event: PlayerEvent,
    playerId: number,
    ipAddress?: string,
  ): Promise<void> {
    if (!this.eventNotificationService) {
      return
    }

    try {
      const connectEvent = event as PlayerConnectEvent
      const meta = event.meta as PlayerMeta

      // Get player country from database (GeoIP enrichment happens before this)
      let playerCountry: string | undefined
      try {
        const player = await this.repository.findById(playerId)
        playerCountry = player?.country || undefined
      } catch (error) {
        this.logger.warn(`Failed to fetch player country for notification: ${error}`)
      }

      // Calculate connection time (for now just use 0, could be enhanced)
      const connectionTime = 0

      await this.eventNotificationService.notifyConnectEvent({
        serverId: event.serverId,
        playerId,
        playerName: meta?.playerName,
        playerCountry,
        steamId: connectEvent.data.steamId,
        ipAddress: ipAddress || "",
        connectionTime,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.warn(`Failed to send connect notification: ${error}`)
    }
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
   * Update server last event timestamp
   */
  private async updateServerStats(serverId: number): Promise<void> {
    try {
      // Note: activePlayers count is now updated via RCON enricher
      await this.repository.updateServerForPlayerEvent?.(serverId, {
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
