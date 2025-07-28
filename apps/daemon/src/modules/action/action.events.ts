/**
 * Action Module Event Handler
 *
 * Handles action-specific events including player actions, team actions,
 * and world actions. This handler manages all action event types independently.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { IActionService, ActionEvent } from "@/modules/action/action.types"
import { EventType } from "@/shared/types/events"

export class ActionEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly actionService: IActionService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
    this.registerEventHandlers()
  }

  registerEventHandlers(): void {
    // All action events have been migrated to queue-only processing (Phase 1)
    // - ACTION_PLAYER, ACTION_PLAYER_PLAYER, ACTION_TEAM, ACTION_WORLD
    // These are now handled via RabbitMQConsumer and no longer use EventBus
  }

  // Queue-compatible handler methods (called by RabbitMQConsumer)
  async handleActionPlayer(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_PLAYER for server ${event.serverId}`)

    const actionEvent = event as ActionEvent
    this.logPlayerInfo(actionEvent)

    await this.actionService.handleActionEvent(actionEvent)
  }

  async handleActionPlayerPlayer(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_PLAYER_PLAYER for server ${event.serverId}`)

    const actionEvent = event as ActionEvent
    this.logPlayerInfo(actionEvent)

    await this.actionService.handleActionEvent(actionEvent)
  }

  async handleActionTeam(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_TEAM for server ${event.serverId}`)

    await this.actionService.handleActionEvent(event as ActionEvent)
  }

  async handleActionWorld(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_WORLD for server ${event.serverId}`)

    await this.actionService.handleActionEvent(event as ActionEvent)
  }

  /**
   * Add player information to the log based on event type
   * This logic was moved from EventProcessor to keep action handling self-contained
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
}
