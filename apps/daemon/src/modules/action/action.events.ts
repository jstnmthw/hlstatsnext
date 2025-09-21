/**
 * Action Module Event Handler
 *
 * Handles action-specific events including player actions, team actions,
 * and world actions. This handler manages all action event types independently.
 */

import { EventType } from "@/shared/types/events"
import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { IActionService, ActionEvent } from "@/modules/action/action.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IPlayerService } from "@/modules/player/player.types"
import type { IServerService } from "@/modules/server/server.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"

export class ActionEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly actionService: IActionService,
    private readonly sessionService: IPlayerSessionService,
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

    const actionEvent = await this.resolvePlayerIds(event as ActionEvent)
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

    const actionEvent = await this.resolvePlayerIds(event as ActionEvent)
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
   * Convert gameUserId to database playerId using session service
   */
  private async resolvePlayerIds<T extends BaseEvent>(event: T): Promise<T> {
    try {
      if (
        event.eventType !== EventType.ACTION_PLAYER &&
        event.eventType !== EventType.ACTION_PLAYER_PLAYER
      ) {
        return event
      }

      const data = (event.data as Record<string, unknown>) || {}
      const resolved: Record<string, unknown> = { ...data }

      // Convert gameUserId to database playerId for ACTION_PLAYER
      if (typeof data.gameUserId === "number") {
        const session = await this.sessionService.getSessionByGameUserId(
          event.serverId,
          data.gameUserId,
        )

        if (session) {
          resolved.playerId = session.databasePlayerId
          this.logger.debug(
            `Resolved gameUserId ${data.gameUserId} to database playerId ${session.databasePlayerId} for action event`,
          )
        } else {
          // Try to create a fallback session for the player
          this.logger.debug(
            `No session found for gameUserId ${data.gameUserId} on server ${event.serverId}, attempting fallback session creation`,
          )

          try {
            // Try to synchronize sessions for this server to create missing sessions
            await this.sessionService.synchronizeServerSessions(event.serverId, {
              clearExisting: false,
            })

            // Try to get the session again after synchronization
            const fallbackSession = await this.sessionService.getSessionByGameUserId(
              event.serverId,
              data.gameUserId,
            )

            if (fallbackSession) {
              resolved.playerId = fallbackSession.databasePlayerId
              this.logger.debug(
                `Created fallback session for gameUserId ${data.gameUserId} -> playerId ${fallbackSession.databasePlayerId}`,
              )
            } else {
              // Last resort: use gameUserId as playerId
              this.logger.warn(
                `Could not create session for gameUserId ${data.gameUserId} on server ${event.serverId}, using gameUserId as fallback`,
              )
              resolved.playerId = data.gameUserId
            }
          } catch (error) {
            this.logger.warn(
              `Failed to create fallback session for gameUserId ${data.gameUserId} on server ${event.serverId}: ${error}`,
            )
            resolved.playerId = data.gameUserId
          }
        }

        // Remove gameUserId from resolved data since ActionEvent expects playerId
        delete resolved.gameUserId
      }

      // Convert victimGameUserId to database victimId for ACTION_PLAYER_PLAYER
      if (typeof data.victimGameUserId === "number") {
        const victimSession = await this.sessionService.getSessionByGameUserId(
          event.serverId,
          data.victimGameUserId,
        )

        if (victimSession) {
          resolved.victimId = victimSession.databasePlayerId
          this.logger.debug(
            `Resolved victimGameUserId ${data.victimGameUserId} to database victimId ${victimSession.databasePlayerId} for action event`,
          )
        } else {
          this.logger.warn(
            `No session found for victimGameUserId ${data.victimGameUserId} on server ${event.serverId}, action may fail`,
          )
          resolved.victimId = data.victimGameUserId
        }

        // Remove victimGameUserId from resolved data
        delete resolved.victimGameUserId
      }

      return { ...event, data: resolved } as T
    } catch (error) {
      this.logger.error(`Failed to resolve player ids for event ${event.eventType}: ${error}`)
      return event
    }
  }
}
