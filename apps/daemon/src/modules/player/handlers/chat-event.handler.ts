/**
 * Player Chat Event Handler
 *
 * Handles chat message events by storing them in the database
 * for historical tracking and analysis.
 */

import type { IMapService } from "@/modules/map/map.service"
import type { IMatchService } from "@/modules/match/match.types"
import type {
  IPlayerRepository,
  PlayerChatEvent,
  PlayerEvent,
} from "@/modules/player/types/player.types"
import type { HandlerResult } from "@/shared/types/common"
import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import { BasePlayerEventHandler } from "./base-player-event.handler"

export class ChatEventHandler extends BasePlayerEventHandler {
  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    matchService?: IMatchService,
    mapService?: IMapService,
  ) {
    super(repository, logger, matchService, mapService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.CHAT_MESSAGE) {
        return this.createErrorResult("Invalid event type for ChatEventHandler")
      }

      const chatEvent = event as PlayerChatEvent
      const { playerId, message, messageMode } = chatEvent.data

      // Get current map
      const map = await this.getCurrentMap(event.serverId)

      // Store chat message in database
      await this.repository.createChatEvent(
        playerId,
        event.serverId,
        map,
        message,
        messageMode || 0,
      )

      this.logger.debug(`Player ${playerId} says: "${message}"`)

      return this.createSuccessResult()
    })
  }
}
