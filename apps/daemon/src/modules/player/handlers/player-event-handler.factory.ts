/**
 * Player Event Handler Factory
 *
 * Factory for creating event-specific handlers based on event type.
 * This implements the strategy pattern to eliminate the large switch
 * statement in PlayerService.handlePlayerEvent.
 */

import { EventType } from "@/shared/types/events"
import { ConnectEventHandler } from "./connect-event.handler"
import { DisconnectEventHandler } from "./disconnect-event.handler"
import { EntryEventHandler } from "./entry-event.handler"
import { ChangeTeamEventHandler } from "./change-team-event.handler"
import { ChangeNameEventHandler } from "./change-name-event.handler"
import { SuicideEventHandler } from "./suicide-event.handler"
import { DamageEventHandler } from "./damage-event.handler"
import { TeamkillEventHandler } from "./teamkill-event.handler"
import { ChatEventHandler } from "./chat-event.handler"
import { KillEventHandler } from "./kill-event.handler"
import type { BasePlayerEventHandler } from "./base-player-event.handler"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IServerRepository, IServerService } from "@/modules/server/server.types"
import type { IEventNotificationService } from "@/modules/rcon/services/event-notification.service"
import type { IPlayerSessionService } from "@/modules/player/types/player-session.types"
import type { IPlayerService } from "@/modules/player/player.types"

export class PlayerEventHandlerFactory {
  private readonly handlers = new Map<EventType, BasePlayerEventHandler>()

  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    rankingService: IRankingService,
    serverRepository: IServerRepository,
    serverService: IServerService,
    sessionService: IPlayerSessionService,
    playerService: IPlayerService,
    matchService?: IMatchService,
    geoipService?: { lookup(ipWithPort: string): Promise<unknown | null> },
    eventNotificationService?: IEventNotificationService,
  ) {
    // Initialize all event handlers
    this.handlers.set(
      EventType.PLAYER_CONNECT,
      new ConnectEventHandler(
        repository,
        logger,
        sessionService,
        playerService,
        serverService,
        matchService,
        geoipService,
        eventNotificationService,
      ),
    )

    this.handlers.set(
      EventType.PLAYER_DISCONNECT,
      new DisconnectEventHandler(
        repository,
        logger,
        sessionService,
        matchService,
        serverRepository,
        eventNotificationService,
      ),
    )

    this.handlers.set(
      EventType.PLAYER_ENTRY,
      new EntryEventHandler(
        repository,
        logger,
        sessionService,
        playerService,
        serverService,
        matchService,
      ),
    )

    this.handlers.set(
      EventType.PLAYER_CHANGE_TEAM,
      new ChangeTeamEventHandler(repository, logger, matchService),
    )

    this.handlers.set(
      EventType.PLAYER_CHANGE_NAME,
      new ChangeNameEventHandler(repository, logger, matchService),
    )

    this.handlers.set(
      EventType.PLAYER_SUICIDE,
      new SuicideEventHandler(
        repository,
        logger,
        matchService,
        rankingService,
        eventNotificationService,
      ),
    )

    this.handlers.set(
      EventType.PLAYER_DAMAGE,
      new DamageEventHandler(repository, logger, matchService),
    )

    this.handlers.set(
      EventType.PLAYER_TEAMKILL,
      new TeamkillEventHandler(
        repository,
        logger,
        matchService,
        rankingService,
        eventNotificationService,
      ),
    )

    this.handlers.set(
      EventType.CHAT_MESSAGE,
      new ChatEventHandler(repository, logger, matchService),
    )

    this.handlers.set(
      EventType.PLAYER_KILL,
      new KillEventHandler(
        repository,
        logger,
        matchService,
        rankingService,
        eventNotificationService,
      ),
    )

    // Note: PLAYER_CHANGE_ROLE is not implemented as it doesn't affect stats
  }

  /**
   * Get the appropriate handler for an event type
   */
  getHandler(eventType: EventType): BasePlayerEventHandler | null {
    return this.handlers.get(eventType) || null
  }

  /**
   * Check if a handler exists for the given event type
   */
  hasHandler(eventType: EventType): boolean {
    return this.handlers.has(eventType)
  }

  /**
   * Get all supported event types
   */
  getSupportedEventTypes(): EventType[] {
    return Array.from(this.handlers.keys())
  }
}
