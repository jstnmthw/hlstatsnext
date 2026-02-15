/**
 * Action Module Event Handler
 *
 * Handles action-specific events including player actions, team actions,
 * and world actions. This handler manages all action event types independently.
 */

import type {
  ActionEvent,
  ActionPlayerEvent,
  ActionPlayerPlayerEvent,
  IActionService,
  RawActionPlayerEvent,
  RawActionPlayerPlayerEvent,
} from "@/modules/action/action.types"
import {
  isActionTeamEvent,
  isRawActionPlayerEvent,
  isRawActionPlayerPlayerEvent,
  isWorldActionEvent,
} from "@/modules/action/action.types"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { BaseEvent } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"

export class ActionEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly actionService: IActionService,
    private readonly sessionService: IPlayerSessionService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
  }

  async handleActionPlayer(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_PLAYER for server ${event.serverId}`)

    if (!isRawActionPlayerEvent(event)) {
      this.logger.warn(`Invalid ACTION_PLAYER event structure for server ${event.serverId}`)
      return
    }

    const resolvedEvent = await this.resolveActionPlayerEvent(event)
    this.logPlayerInfo(resolvedEvent)

    await this.actionService.handleActionEvent(resolvedEvent)
  }

  async handleActionPlayerPlayer(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_PLAYER_PLAYER for server ${event.serverId}`)

    if (!isRawActionPlayerPlayerEvent(event)) {
      this.logger.warn(`Invalid ACTION_PLAYER_PLAYER event structure for server ${event.serverId}`)
      return
    }

    const resolvedEvent = await this.resolveActionPlayerPlayerEvent(event)
    this.logPlayerInfo(resolvedEvent)

    await this.actionService.handleActionEvent(resolvedEvent)
  }

  async handleActionTeam(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_TEAM for server ${event.serverId}`)

    if (!isActionTeamEvent(event)) {
      this.logger.warn(`Invalid ACTION_TEAM event structure for server ${event.serverId}`)
      return
    }

    await this.actionService.handleActionEvent(event)
  }

  async handleActionWorld(event: BaseEvent): Promise<void> {
    this.logger.debug(`Action module handling ACTION_WORLD for server ${event.serverId}`)

    if (!isWorldActionEvent(event)) {
      this.logger.warn(`Invalid ACTION_WORLD event structure for server ${event.serverId}`)
      return
    }

    await this.actionService.handleActionEvent(event)
  }

  /**
   * Add player information to the log based on event type
   */
  private logPlayerInfo(actionEvent: ActionEvent): void {
    let playerInfo = ""

    if (actionEvent.eventType === EventType.ACTION_PLAYER) {
      playerInfo = `, playerId=${actionEvent.data.playerId}`
    } else if (actionEvent.eventType === EventType.ACTION_PLAYER_PLAYER) {
      playerInfo = `, playerId=${actionEvent.data.playerId}, victimId=${actionEvent.data.victimId}`
    }

    if (playerInfo) {
      this.logger.debug(
        `Processing action event: ${actionEvent.eventType} for server ${actionEvent.serverId}${playerInfo}`,
      )
    }
  }

  /**
   * Resolve gameUserId to database playerId for ACTION_PLAYER events
   */
  private async resolveActionPlayerEvent(event: RawActionPlayerEvent): Promise<ActionPlayerEvent> {
    try {
      const { gameUserId, ...restData } = event.data
      const session = await this.sessionService.getSessionByGameUserId(event.serverId, gameUserId)

      if (session) {
        this.logger.debug(
          `Resolved gameUserId ${gameUserId} to database playerId ${session.databasePlayerId} for action event`,
        )

        return {
          ...event,
          data: {
            ...restData,
            playerId: session.databasePlayerId,
          },
        }
      } else {
        // Try to create a fallback session for the player
        this.logger.debug(
          `No session found for gameUserId ${gameUserId} on server ${event.serverId}, attempting fallback session creation`,
        )

        try {
          // Try to synchronize sessions for this server to create missing sessions
          await this.sessionService.synchronizeServerSessions(event.serverId, {
            clearExisting: false,
          })

          // Try to get the session again after synchronization
          const fallbackSession = await this.sessionService.getSessionByGameUserId(
            event.serverId,
            gameUserId,
          )

          if (fallbackSession) {
            this.logger.debug(
              `Created fallback session for gameUserId ${gameUserId} → playerId ${fallbackSession.databasePlayerId}`,
            )

            return {
              ...event,
              data: {
                ...restData,
                playerId: fallbackSession.databasePlayerId,
              },
            }
          } else {
            // Last resort: use gameUserId as playerId
            this.logger.warn(
              `Could not create session for gameUserId ${gameUserId} on server ${event.serverId}, using gameUserId as fallback`,
            )

            return {
              ...event,
              data: {
                ...restData,
                playerId: gameUserId,
              },
            }
          }
        } catch (error) {
          this.logger.warn(
            `Failed to create fallback session for gameUserId ${gameUserId} on server ${event.serverId}: ${error}`,
          )

          return {
            ...event,
            data: {
              ...restData,
              playerId: gameUserId,
            },
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to resolve player ids for ACTION_PLAYER event: ${error}`)

      // Fallback to using gameUserId as playerId
      const { gameUserId, ...restData } = event.data
      return {
        ...event,
        data: {
          ...restData,
          playerId: gameUserId,
        },
      }
    }
  }

  /**
   * Resolve gameUserId and victimGameUserId to database playerIds for ACTION_PLAYER_PLAYER events
   */
  private async resolveActionPlayerPlayerEvent(
    event: RawActionPlayerPlayerEvent,
  ): Promise<ActionPlayerPlayerEvent> {
    try {
      const { gameUserId, victimGameUserId, ...restData } = event.data

      // Resolve both player IDs
      const [session, victimSession] = await Promise.all([
        this.sessionService.getSessionByGameUserId(event.serverId, gameUserId),
        this.sessionService.getSessionByGameUserId(event.serverId, victimGameUserId),
      ])

      const playerId = session ? session.databasePlayerId : gameUserId
      const victimId = victimSession ? victimSession.databasePlayerId : victimGameUserId

      if (session) {
        this.logger.debug(
          `Resolved gameUserId ${gameUserId} to database playerId ${session.databasePlayerId} for action event`,
        )
      } else {
        this.logger.warn(
          `No session found for gameUserId ${gameUserId} on server ${event.serverId}, using gameUserId as fallback`,
        )
      }

      if (victimSession) {
        this.logger.debug(
          `Resolved victimGameUserId ${victimGameUserId} to database victimId ${victimSession.databasePlayerId} for action event`,
        )
      } else {
        this.logger.warn(
          `No session found for victimGameUserId ${victimGameUserId} on server ${event.serverId}, using victimGameUserId as fallback`,
        )
      }

      return {
        ...event,
        data: {
          ...restData,
          playerId,
          victimId,
        },
      }
    } catch (error) {
      this.logger.error(`Failed to resolve player ids for ACTION_PLAYER_PLAYER event: ${error}`)

      // Fallback to using raw IDs
      const { gameUserId, victimGameUserId, ...restData } = event.data
      return {
        ...event,
        data: {
          ...restData,
          playerId: gameUserId,
          victimId: victimGameUserId,
        },
      }
    }
  }
}
