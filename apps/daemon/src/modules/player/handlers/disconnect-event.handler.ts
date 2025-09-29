/**
 * Player Disconnect Event Handler
 *
 * Handles player disconnection events including session cleanup,
 * session duration tracking, and server stats updates.
 */

import { BasePlayerEventHandler } from "./base-player-event.handler"
import { EventType } from "@/shared/types/events"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import { PlayerNameUpdateBuilder } from "@/shared/application/utils/player-name-update.builder"
import { sanitizePlayerName } from "@/shared/utils/validation"
import type { HandlerResult } from "@/shared/types/common"
import type { PlayerEvent, PlayerDisconnectEvent } from "@/modules/player/types/player.types"
import type { PlayerMeta } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/types/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IServerRepository } from "@/modules/server/server.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IEventNotificationService } from "@/modules/rcon/services/event-notification.service"

export class DisconnectEventHandler extends BasePlayerEventHandler {
  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    private readonly sessionService: IPlayerSessionService,
    matchService: IMatchService | undefined,
    private readonly serverRepository: IServerRepository,
    private readonly eventNotificationService?: IEventNotificationService,
  ) {
    super(repository, logger, matchService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_DISCONNECT) {
        return this.createErrorResult("Invalid event type for DisconnectEventHandler")
      }

      const disconnectEvent = event as PlayerDisconnectEvent
      const { gameUserId, playerId } = disconnectEvent.data
      const meta = event.meta as PlayerMeta

      let databasePlayerId: number
      let sessionDuration = 0

      // Try to look up the session first if we have a valid gameUserId
      if (gameUserId !== undefined && gameUserId !== -1) {
        const session = await this.sessionService.getSessionByGameUserId(event.serverId, gameUserId)

        if (session) {
          databasePlayerId = session.databasePlayerId
          sessionDuration = Math.floor((Date.now() - session.connectedAt.getTime()) / 1000)

          // Remove the session
          await this.sessionService.removeSession(event.serverId, gameUserId)
        } else {
          // Try to resolve by Steam ID if we have it in meta
          if (meta?.steamId) {
            const sessionBySteam = await this.sessionService.getSessionBySteamId(
              event.serverId,
              meta.steamId,
            )
            if (sessionBySteam) {
              // Remove the session (it may have wrong game user ID)
              await this.sessionService.removeSession(event.serverId, sessionBySteam.gameUserId)
              this.logger.debug(`Cleaned up mismatched session for ${meta.playerName}`)
            }
          }

          // Use resolved playerId from PlayerEventHandler if available
          if (playerId !== undefined && playerId > 0) {
            databasePlayerId = playerId
          } else {
            // Try to resolve invalid playerId (for bots)
            const originalPlayerId = disconnectEvent.data.playerId || -1
            const resolvedPlayerId = await this.resolvePlayerId(
              originalPlayerId,
              disconnectEvent,
              event.serverId,
            )
            if (resolvedPlayerId > 0) {
              databasePlayerId = resolvedPlayerId
            } else {
              this.logger.debug("No session and no valid playerId, skipping disconnect processing")
              return this.createSuccessResult()
            }
          }
        }
      } else {
        // No valid gameUserId, use resolved playerId from PlayerEventHandler
        if (playerId !== undefined && playerId > 0) {
          databasePlayerId = playerId

          // For events without sessions (like bot disconnects), we can't calculate duration
          this.logger.debug(`Using resolved playerId ${playerId} for disconnect without session`)
        } else {
          // Try to resolve invalid playerId (for bots)
          const originalPlayerId = disconnectEvent.data.playerId || -1
          const resolvedPlayerId = await this.resolvePlayerId(
            originalPlayerId,
            disconnectEvent,
            event.serverId,
          )
          if (resolvedPlayerId > 0) {
            databasePlayerId = resolvedPlayerId
            this.logger.debug(
              `Resolved invalid playerId to ${databasePlayerId} for disconnect without session`,
            )
          } else {
            this.logger.debug("No valid gameUserId or playerId, skipping disconnect processing")
            return this.createSuccessResult()
          }
        }
      }

      // Update player stats with session duration
      await this.updatePlayerStats(databasePlayerId, sessionDuration)

      // Update player name stats
      await this.updatePlayerNameStats(databasePlayerId, meta, sessionDuration)

      // Update server stats
      await this.updateServerStats(event.serverId)

      // Create disconnect event log
      await this.createDisconnectEventLog(databasePlayerId, event.serverId)

      // Send disconnect notification
      await this.sendDisconnectNotification(event, databasePlayerId, sessionDuration)

      this.logger.debug(
        `Player ${meta?.playerName || "unknown"} disconnected: gameUserId=${gameUserId}, databasePlayerId=${databasePlayerId}, duration=${sessionDuration}s`,
      )

      return this.createSuccessResult()
    })
  }

  /**
   * Send disconnect event notification
   */
  private async sendDisconnectNotification(
    event: PlayerEvent,
    playerId: number,
    sessionDuration: number,
  ): Promise<void> {
    if (!this.eventNotificationService) {
      return
    }

    try {
      const disconnectEvent = event as PlayerDisconnectEvent
      const meta = event.meta as PlayerMeta

      // Get current player skill and country for notification
      const playerStats = await this.repository.getPlayerStats(playerId)
      const playerSkill = playerStats?.skill || 1000

      // Get player country from database
      let playerCountry: string | undefined
      try {
        const player = await this.repository.findById(playerId)
        playerCountry = player?.country || undefined
      } catch (error) {
        this.logger.warn(`Failed to fetch player country for disconnect notification: ${error}`)
      }

      await this.eventNotificationService.notifyDisconnectEvent({
        serverId: event.serverId,
        playerId,
        playerName: meta?.playerName,
        playerCountry,
        playerSkill,
        reason: disconnectEvent.data.reason || "Disconnect",
        sessionDuration,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.warn(`Failed to send disconnect notification: ${error}`)
    }
  }

  /**
   * Resolve player ID when it's invalid (handles bot resolution)
   */
  private async resolvePlayerId(
    playerId: number,
    disconnectEvent: PlayerDisconnectEvent,
    serverId: number,
  ): Promise<number> {
    // If valid player ID, return as-is
    if (playerId > 0) {
      return playerId
    }

    const meta = disconnectEvent.meta

    this.logger.debug(`Disconnect event with invalid playerId ${playerId}:`, {
      playerName: meta?.playerName,
      steamId: meta?.steamId,
      isBot: meta?.isBot,
    })

    // Attempt to resolve by player name (especially for bots)
    if (meta?.playerName) {
      try {
        const server = await this.serverRepository.findById(serverId)
        const game = server?.game || "csgo"

        // Try to find a bot with the BOT_ prefix (server-specific)
        const normalizedName = sanitizePlayerName(meta.playerName)
        const botUniqueId = `BOT_${serverId}_${normalizedName}`

        const existingBot = await this.repository.findByUniqueId(botUniqueId, game)
        if (existingBot) {
          this.logger.info(
            `Resolved bot ${meta.playerName} to playerId ${existingBot.playerId} for disconnect`,
          )
          return existingBot.playerId
        } else {
          this.logger.debug(
            `Player ${meta.playerName} with invalid playerId not found as bot, cannot resolve`,
          )
        }
      } catch (error) {
        this.logger.debug(`Failed to resolve player ${meta.playerName} for disconnect: ${error}`)
      }
    } else {
      this.logger.warn(
        `Invalid playerId ${playerId} with no player name - cannot resolve disconnect event`,
      )
    }

    return 0 // Return 0 to indicate unresolved
  }

  /**
   * Update player statistics
   */
  private async updatePlayerStats(playerId: number, sessionDuration?: number): Promise<void> {
    const updateBuilder = StatUpdateBuilder.create().updateLastEvent()

    if (sessionDuration && sessionDuration > 0) {
      updateBuilder.addConnectionTime(sessionDuration)
    }

    await this.repository.update(playerId, updateBuilder.build())
  }

  /**
   * Update player name statistics
   */
  private async updatePlayerNameStats(
    playerId: number,
    meta?: PlayerMeta,
    sessionDuration?: number,
  ): Promise<void> {
    try {
      const currentName = meta?.playerName
      if (currentName && sessionDuration && sessionDuration > 0) {
        const nameUpdate = PlayerNameUpdateBuilder.forDisconnect(sessionDuration)
        await this.repository.upsertPlayerName(playerId, currentName, nameUpdate.build())
      }
    } catch (error) {
      this.logger.warn(`Failed to update player name on disconnect for ${playerId}: ${error}`)
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
    } catch {
      // Optional repository hook may not exist; ignore if unavailable
      this.logger.debug(`Server stats update not available for disconnect on server ${serverId}`)
    }
  }

  /**
   * Create disconnect event log and enrich last connect
   */
  private async createDisconnectEventLog(playerId: number, serverId: number): Promise<void> {
    try {
      const map = await this.getCurrentMap(serverId)
      await this.repository.createDisconnectEvent(playerId, serverId, map)
      this.logger.debug(`Created disconnect event for player ${playerId} on server ${serverId}`)
    } catch (error) {
      this.logger.warn(
        `Failed to create disconnect event for player ${playerId} on server ${serverId}: ${error}`,
      )
    }
  }
}
