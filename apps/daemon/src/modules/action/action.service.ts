/**
 * Action Service
 */

import type {
  IActionService,
  ActionEvent,
  ActionPlayerEvent,
  ActionPlayerPlayerEvent,
  ActionTeamEvent,
  WorldActionEvent,
} from "./action.types"
import type { ILogger } from "@/shared/utils/logger"
import type { HandlerResult } from "@/shared/types/common"
import { EventType } from "@/shared/types/events"

export class ActionService implements IActionService {
  constructor(private readonly logger: ILogger) {}

  async handleActionEvent(event: ActionEvent): Promise<HandlerResult> {
    try {
      switch (event.eventType) {
        case EventType.ACTION_PLAYER:
          return await this.handlePlayerAction(event)
        case EventType.ACTION_PLAYER_PLAYER:
          return await this.handlePlayerPlayerAction(event)
        case EventType.ACTION_TEAM:
          return await this.handleTeamAction(event)
        case EventType.ACTION_WORLD:
          return await this.handleWorldAction(event)
        default:
          return { success: true }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handlePlayerAction(event: ActionPlayerEvent): Promise<HandlerResult> {
    this.logger.debug(`Player action: ${event.data.actionCode} by player ${event.data.playerId}`)
    return { success: true }
  }

  private async handlePlayerPlayerAction(event: ActionPlayerPlayerEvent): Promise<HandlerResult> {
    this.logger.debug(
      `Player-player action: ${event.data.actionCode} by ${event.data.playerId} on ${event.data.victimId}`,
    )
    return { success: true }
  }

  private async handleTeamAction(event: ActionTeamEvent): Promise<HandlerResult> {
    this.logger.debug(`Team action: ${event.data.actionCode} by team ${event.data.team}`)
    return { success: true }
  }

  private async handleWorldAction(event: WorldActionEvent): Promise<HandlerResult> {
    this.logger.debug(`World action: ${event.data.actionCode}`)
    return { success: true }
  }
}
