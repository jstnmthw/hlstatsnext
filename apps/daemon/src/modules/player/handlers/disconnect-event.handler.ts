/**
 * Player Disconnect Event Handler
 *
 * Handles player disconnection events including player resolution,
 * session duration tracking, and server stats updates.
 */

import { BasePlayerEventHandler } from "./base-player-event.handler"
import { EventType } from "@/shared/types/events"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import { PlayerNameUpdateBuilder } from "@/shared/application/utils/player-name-update.builder"
import { sanitizePlayerName } from "@/shared/utils/validation"
import type { HandlerResult } from "@/shared/types/common"
import type { PlayerEvent, PlayerDisconnectEvent } from "@/modules/player/player.types"
import type { PlayerMeta } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IServerRepository } from "@/modules/server/server.types"

export class DisconnectEventHandler extends BasePlayerEventHandler {
  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    matchService: IMatchService | undefined,
    private readonly serverRepository: IServerRepository,
  ) {
    super(repository, logger, matchService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_DISCONNECT) {
        return this.createErrorResult("Invalid event type for DisconnectEventHandler")
      }

      const disconnectEvent = event as PlayerDisconnectEvent
      const { sessionDuration } = disconnectEvent.data
      let { playerId } = disconnectEvent.data

      // Resolve player ID if invalid
      playerId = await this.resolvePlayerId(playerId, disconnectEvent, event.serverId)

      if (playerId <= 0) {
        this.logger.debug("Invalid player ID resolved for disconnect, skipping event")
        return this.createSuccessResult(0)
      }

      // Update player stats
      await this.updatePlayerStats(playerId, sessionDuration)

      // Update player name stats
      await this.updatePlayerNameStats(playerId, event.meta as PlayerMeta, sessionDuration)

      // Update server stats
      await this.updateServerStats(event.serverId)

      // Create disconnect event log
      await this.createDisconnectEventLog(playerId, event.serverId)

      this.logger.debug(`Player disconnected: ${playerId}`)

      return this.createSuccessResult()
    })
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

        // Try to find a bot with the BOT_ prefix
        const normalizedName = sanitizePlayerName(meta.playerName)
        const botUniqueId = `BOT_${normalizedName}`

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
   * Update server active players count
   */
  private async updateServerStats(serverId: number): Promise<void> {
    try {
      await this.repository.updateServerForPlayerEvent?.(serverId, {
        activePlayers: { decrement: 1 },
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