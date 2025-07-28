/**
 * Action Module Event Handler
 *
 * Handles action-specific events including player actions, team actions,
 * and world actions. This handler manages all action event types independently.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/module-event-handler.base"
import type { BaseEvent } from "@/shared/types/events"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/event-metrics"
import type { IActionService, ActionEvent } from "@/modules/action/action.types"
import { EventType } from "@/shared/types/events"

export class ActionEventHandler extends BaseModuleEventHandler {
  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    private readonly actionService: IActionService,
    metrics?: EventMetrics,
  ) {
    super(eventBus, logger, metrics)
    this.registerEventHandlers()
  }

  registerEventHandlers(): void {
    // All action event types
    this.registerHandler(EventType.ACTION_PLAYER, this.handleActionPlayer.bind(this))
    this.registerHandler(EventType.ACTION_PLAYER_PLAYER, this.handleActionPlayerPlayer.bind(this))
    this.registerHandler(EventType.ACTION_TEAM, this.handleActionTeam.bind(this))
    this.registerHandler(EventType.ACTION_WORLD, this.handleActionWorld.bind(this))
  }

  private async handleActionPlayer(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_PLAYER for server ${event.serverId}`)

    const actionEvent = event as ActionEvent
    this.logPlayerInfo(actionEvent)

    await this.actionService.handleActionEvent(actionEvent)
  }

  private async handleActionPlayerPlayer(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_PLAYER_PLAYER for server ${event.serverId}`)

    const actionEvent = event as ActionEvent
    this.logPlayerInfo(actionEvent)

    await this.actionService.handleActionEvent(actionEvent)
  }

  private async handleActionTeam(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_TEAM for server ${event.serverId}`)

    await this.actionService.handleActionEvent(event as ActionEvent)
  }

  private async handleActionWorld(event: BaseEvent): Promise<void> {
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
