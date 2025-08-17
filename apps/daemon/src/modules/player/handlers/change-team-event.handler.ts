/**
 * Player Change Team Event Handler
 *
 * Handles player team change events including in-memory match
 * team assignment and event logging.
 */

import { BasePlayerEventHandler } from "./base-player-event.handler"
import { EventType } from "@/shared/types/events"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import type { HandlerResult } from "@/shared/types/common"
import type { PlayerEvent } from "@/modules/player/player.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"

export class ChangeTeamEventHandler extends BasePlayerEventHandler {
  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    matchService?: IMatchService,
  ) {
    super(repository, logger, matchService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_CHANGE_TEAM) {
        return this.createErrorResult("Invalid event type for ChangeTeamEventHandler")
      }

      const changeTeamEvent = event as { data: { playerId: number; team: string } }
      const { playerId, team } = changeTeamEvent.data

      // Update in-memory match team assignment
      this.matchService?.setPlayerTeam?.(event.serverId, playerId, team)

      // Get current map and create change team event
      const map = await this.getCurrentMap(event.serverId)

      // Execute operations in parallel
      const operations: Array<Promise<unknown>> = []

      // Create change team event log
      try {
        operations.push(
          this.repository.createChangeTeamEvent?.(playerId, event.serverId, map, team) ??
            Promise.resolve(),
        )
      } catch {
        this.logger.error(
          `Failed to create change-team event for player ${playerId} on server ${event.serverId}`,
        )
      }

      // Update player last event timestamp
      const playerUpdate = StatUpdateBuilder.create().updateLastEvent()
      operations.push(this.repository.update(playerId, playerUpdate.build()))

      await Promise.all(operations)

      this.logger.debug(`Player ${playerId} changed team to ${team}`)

      return this.createSuccessResult()
    })
  }
}