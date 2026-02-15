/**
 * Match Module Event Handler
 *
 * Handles match-specific events including rounds, objectives, and match statistics.
 * This handler manages match lifecycle events and coordinates match-related
 * statistics independently from other modules.
 */

import type { IActionService } from "@/modules/action/action.types"
import type { IMatchService, MatchEvent } from "@/modules/match/match.types"
import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"

export class MatchEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly matchService: IMatchService,
    private readonly actionService?: IActionService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
  }

  /**
   * Handle round start event
   *
   * This method handles round start events by updating match statistics.
   * It is used to track round start events and update match statistics accordingly.
   *
   * @param event - The round start event
   */
  async handleRoundStart(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling ROUND_START for server ${event.serverId}`)
    await this.matchService.handleMatchEvent(event as MatchEvent)
  }

  /**
   * Handle round end event
   *
   * This method handles round end events by updating match statistics.
   * It is used to track round end events and update match statistics accordingly.
   *
   * @param event - The round end event
   */
  async handleRoundEnd(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling ROUND_END for server ${event.serverId}`)
    await this.matchService.handleMatchEvent(event as MatchEvent)
  }

  /**
   * Handle team win event
   *
   * This method handles team win events by updating match statistics.
   * It is used to track team win events and update match statistics accordingly.
   *
   * @param event - The team win event
   */
  async handleTeamWin(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling TEAM_WIN for server ${event.serverId}`)
    await this.matchService.handleMatchEvent(event as MatchEvent)

    // Synthesize ACTION_TEAM for win triggers to award team-wide bonuses per legacy
    try {
      if (!this.actionService) return
      const data = (event as unknown as MatchEvent).data as {
        winningTeam: string
        triggerName: string
      }
      const game = (await this.matchService.getServerGame(event.serverId)) || "valve"
      const actionEvent = {
        eventType: EventType.ACTION_TEAM as const,
        timestamp: new Date(),
        serverId: event.serverId,
        eventId: "synthetic-teamwin",
        data: {
          team: data.winningTeam,
          actionCode: data.triggerName,
          game,
          bonus: 0,
        },
      }
      await this.actionService.handleActionEvent(actionEvent)
    } catch (err) {
      this.logger.warn(`Failed to synthesize ACTION_TEAM for TEAM_WIN: ${String(err)}`)
    }
  }

  /**
   * Handle map change event
   *
   * This method handles map change events by updating match statistics.
   * It is used to track map changes and update match statistics accordingly.
   *
   * @param event - The map change event
   */
  async handleMapChange(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling MAP_CHANGE for server ${event.serverId}`)
    await this.matchService.handleMatchEvent(event as MatchEvent)
  }
}
