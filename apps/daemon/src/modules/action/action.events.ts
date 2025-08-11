/**
 * Action Module Event Handler
 *
 * Handles action-specific events including player actions, team actions,
 * and world actions. This handler manages all action event types independently.
 */

import { EventType } from "@/shared/types/events"
import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { BaseEvent, DualPlayerMeta, PlayerMeta } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { IActionService, ActionEvent } from "@/modules/action/action.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerService } from "@/modules/player/player.types"
import type { IServerService } from "@/modules/server/server.types"

export class ActionEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly actionService: IActionService,
    private readonly matchService?: IMatchService,
    private readonly playerService?: IPlayerService,
    private readonly serverService?: IServerService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
  }

  // Queue-compatible handler methods (called by RabbitMQConsumer)
  async handleActionPlayer(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_PLAYER for server ${event.serverId}`)

    const actionEvent = (await this.resolvePlayerIds(event)) as ActionEvent
    this.logPlayerInfo(actionEvent)

    await this.actionService.handleActionEvent(actionEvent)
    // Inform match service for objective scoring when applicable
    try {
      if (actionEvent.eventType === EventType.ACTION_PLAYER) {
        const { actionCode } = actionEvent.data

        // Bomb-related or key objective actions
        await this.matchService?.handleObjectiveAction(
          actionCode,
          actionEvent.serverId,
          (actionEvent.data as { playerId?: number }).playerId,
          (actionEvent.data as { team?: string }).team,
        )
      }
    } catch {
      // non-fatal
    }
  }

  async handleActionPlayerPlayer(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_PLAYER_PLAYER for server ${event.serverId}`)

    const actionEvent = (await this.resolvePlayerIds(event)) as ActionEvent
    this.logPlayerInfo(actionEvent)

    await this.actionService.handleActionEvent(actionEvent)
  }

  async handleActionTeam(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_TEAM for server ${event.serverId}`)

    const actionEvent = event as ActionEvent
    await this.actionService.handleActionEvent(actionEvent)
    try {
      if (actionEvent.eventType === EventType.ACTION_TEAM) {
        const { actionCode } = actionEvent.data as { actionCode: string }
        await this.matchService?.handleObjectiveAction(
          actionCode,
          actionEvent.serverId,
          undefined,
          (actionEvent.data as { team: string }).team,
        )
      }
    } catch {
      // non-fatal
    }
  }

  async handleActionWorld(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_WORLD for server ${event.serverId}`)

    await this.actionService.handleActionEvent(event as ActionEvent)
  }

  /**
   * Add player information to the log based on event type
   */
  private logPlayerInfo(actionEvent: ActionEvent): void {
    let playerInfo = ""

    if (actionEvent.eventType === EventType.ACTION_PLAYER && "playerId" in actionEvent.data) {
      playerInfo = `, playerId=${actionEvent.data.playerId}`
    } else if (
      actionEvent.eventType === EventType.ACTION_PLAYER_PLAYER &&
      "playerId" in actionEvent.data &&
      "victimId" in actionEvent.data
    ) {
      playerInfo = `, playerId=${actionEvent.data.playerId}, victimId=${actionEvent.data.victimId}`
    }

    if (playerInfo) {
      this.logger.debug(
        `Processing action event: ${actionEvent.eventType} for server ${actionEvent.serverId}${playerInfo}`,
      )
    }
  }

  /**
   * Resolve player ids for action events
   */
  private async resolvePlayerIds(event: BaseEvent): Promise<BaseEvent> {
    try {
      if (!this.playerService || !this.serverService) return event

      if (
        event.eventType !== EventType.ACTION_PLAYER &&
        event.eventType !== EventType.ACTION_PLAYER_PLAYER
      ) {
        return event
      }

      const game = await this.serverService.getServerGame(event.serverId)
      const meta = event.meta as PlayerMeta | DualPlayerMeta | undefined
      const data = (event.data as Record<string, unknown>) || {}
      const resolved: Record<string, unknown> = { ...data }

      if (typeof data.playerId === "number" && meta && "steamId" in meta) {
        const m = meta
        resolved.playerId = await this.playerService.getOrCreatePlayer(
          m.steamId || "",
          m.playerName || "",
          game,
        )
      }

      if (typeof data.victimId === "number" && meta && "victim" in meta) {
        const m = meta

        if (m.victim?.steamId) {
          resolved.victimId = await this.playerService.getOrCreatePlayer(
            m.victim.steamId,
            m.victim.playerName || "",
            game,
          )
        }
      }
      return { ...event, data: resolved }
    } catch {
      this.logger.error(`Failed to resolve player ids for event ${event.eventType}`)
      return event
    }
  }
}
