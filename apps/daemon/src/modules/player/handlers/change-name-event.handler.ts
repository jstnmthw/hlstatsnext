/**
 * Player Change Name Event Handler
 *
 * Handles player name change events including updating the player's
 * last known name and tracking name usage statistics.
 */

import { BasePlayerEventHandler } from "./base-player-event.handler"
import { EventType } from "@/shared/types/events"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import { PlayerNameUpdateBuilder } from "@/shared/application/utils/player-name-update.builder"
import type { HandlerResult } from "@/shared/types/common"
import type { PlayerEvent, PlayerChangeNameEvent } from "@/modules/player/player.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"

export class ChangeNameEventHandler extends BasePlayerEventHandler {
  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    matchService?: IMatchService,
  ) {
    super(repository, logger, matchService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_CHANGE_NAME) {
        return this.createErrorResult("Invalid event type for ChangeNameEventHandler")
      }

      const changeNameEvent = event as PlayerChangeNameEvent
      const { playerId, newName, oldName } = changeNameEvent.data

      // Update player's last known name
      const playerUpdate = StatUpdateBuilder.create()
        .updateLastName(newName)
        .updateLastEvent()

      await this.repository.update(playerId, playerUpdate.build())

      // Create change name event log
      await this.createChangeNameEventLog(playerId, event.serverId, oldName, newName)

      // Update player name usage statistics
      await this.updatePlayerNameUsage(playerId, newName)

      this.logger.debug(`Player ${playerId} changed name from "${oldName}" to "${newName}"`)

      return this.createSuccessResult()
    })
  }

  /**
   * Create change name event log
   */
  private async createChangeNameEventLog(
    playerId: number,
    serverId: number,
    oldName: string,
    newName: string,
  ): Promise<void> {
    try {
      const map = await this.getCurrentMap(serverId)
      await this.repository.createChangeNameEvent?.(playerId, serverId, map, oldName, newName)
    } catch {
      this.logger.error(
        `Failed to create change-name event for player ${playerId} on server ${serverId}`,
      )
    }
  }

  /**
   * Update usage statistics for the new player name
   */
  private async updatePlayerNameUsage(playerId: number, newName: string): Promise<void> {
    try {
      const nameUpdate = PlayerNameUpdateBuilder.create()
        .addUsage(1)
        .updateLastUse()

      await this.repository.upsertPlayerName(playerId, newName, nameUpdate.build())
    } catch (error) {
      this.logger.warn(`Failed to update player name usage for ${playerId}: ${error}`)
    }
  }
}