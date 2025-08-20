/**
 * Player Entry Event Handler
 *
 * Handles player entry events including synthesizing connect events
 * for bots and updating player last event timestamps.
 */

import { BasePlayerEventHandler } from "./base-player-event.handler"
import { EventType } from "@/shared/types/events"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import type { HandlerResult } from "@/shared/types/common"
import type { PlayerEvent } from "@/modules/player/player.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"

export class EntryEventHandler extends BasePlayerEventHandler {
  constructor(repository: IPlayerRepository, logger: ILogger, matchService?: IMatchService) {
    super(repository, logger, matchService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_ENTRY) {
        return this.createErrorResult("Invalid event type for EntryEventHandler")
      }

      const entry = event as { data: { playerId: number } }
      const { playerId } = entry.data

      // Get current map
      const map = await this.getCurrentMap(event.serverId)

      // Synthesize connect if needed (bots often have only "entered the game")
      await this.synthesizeConnectIfNeeded(playerId, event.serverId, map)

      // Log entry event and update player last event
      const operations: Array<Promise<unknown>> = []

      operations.push(
        this.repository.createEntryEvent?.(playerId, event.serverId, map) ?? Promise.resolve(),
      )

      const playerUpdate = StatUpdateBuilder.create().updateLastEvent()
      operations.push(this.repository.update(playerId, playerUpdate.build()))

      await Promise.all(operations)

      this.logger.debug(`Player entry: ${playerId}`)

      return this.createSuccessResult()
    })
  }

  /**
   * Synthesize a connect event if one doesn't exist recently
   */
  private async synthesizeConnectIfNeeded(
    playerId: number,
    serverId: number,
    map: string,
  ): Promise<void> {
    try {
      const hasRecent = await this.repository.hasRecentConnect?.(serverId, playerId, 120000)
      if (!hasRecent) {
        await this.repository.createConnectEvent(playerId, serverId, map, "")
        await this.repository.updateServerForPlayerEvent?.(serverId, {
          activePlayers: { increment: 1 },
          lastEvent: new Date(),
        })
      }
    } catch (error) {
      this.logger.debug(`Failed to synthesize connect event for player ${playerId}: ${error}`)
    }
  }
}
