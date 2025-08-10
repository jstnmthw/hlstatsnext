/**
 * Match Module Event Handler
 *
 * Handles match-specific events including rounds, objectives, and match statistics.
 * This handler manages match lifecycle events and coordinates match-related
 * statistics independently from other modules.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { IMatchService, MatchEvent } from "@/modules/match/match.types"
import type { IActionService } from "@/modules/action/action.types"
import { EventType } from "@/shared/types/events"

export class MatchEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly matchService: IMatchService,
    private readonly actionService?: IActionService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
  }

  // Match lifecycle handlers
  async handleRoundStart(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling ROUND_START for server ${event.serverId}`)
    await this.matchService.handleMatchEvent(event as MatchEvent)
  }

  async handleRoundEnd(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling ROUND_END for server ${event.serverId}`)
    await this.matchService.handleMatchEvent(event as MatchEvent)
  }

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

  async handleMapChange(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module handling MAP_CHANGE for server ${event.serverId}`)
    await this.matchService.handleMatchEvent(event as MatchEvent)
  }

  // Kill event handler for match statistics
  async handlePlayerKill(event: BaseEvent): Promise<void> {
    this.logger.debug(`Match module processing kill event for match stats`)
    await this.matchService.handleKillInMatch(event)
  }
}
