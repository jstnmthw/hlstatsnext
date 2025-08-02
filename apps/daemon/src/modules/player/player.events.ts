/**
 * Player Module Event Handler
 *
 * Handles player-specific events including connections, disconnections,
 * name changes, and chat messages. This handler is responsible for
 * resolving player IDs and delegating to the player service.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { BaseEvent, PlayerMeta } from "@/shared/types/events"
import { EventType } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { IPlayerService, PlayerEvent } from "@/modules/player/player.types"
import type { IServerService } from "@/modules/server/server.types"

interface KillEventMeta {
  killer: {
    steamId: string
    playerName: string
    isBot: boolean
  }
  victim: {
    steamId: string
    playerName: string
    isBot: boolean
  }
}

export class PlayerEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly playerService: IPlayerService,
    private readonly serverService: IServerService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
  }

  /**
   * Single event handler for all player events
   * This is much cleaner than having multiple methods that do the same thing
   */
  async handleEvent(event: BaseEvent): Promise<void> {
    const resolvedEvent = await this.resolvePlayerIds(event)
    await this.playerService.handlePlayerEvent(resolvedEvent)
  }

  /**
   * Resolve Steam IDs to database player IDs for events that contain player references
   * This is moved from EventProcessor to make the player module self-contained
   */
  private async resolvePlayerIds(event: BaseEvent): Promise<PlayerEvent> {
    // Handle different event types with appropriate resolution strategies
    switch (event.eventType) {
      case EventType.PLAYER_KILL:
        return await this.resolveKillEventPlayerIds(event)
      default:
        return await this.resolveSinglePlayerEvent(event)
    }
  }

  /**
   * Resolve player IDs for single-player events (connect, disconnect, chat, etc.)
   */
  private async resolveSinglePlayerEvent(event: BaseEvent): Promise<PlayerEvent> {
    // For events without meta, create a minimal resolved event with just playerId if needed
    if (!event.meta || typeof event.meta !== "object") {
      return {
        ...event,
        data: { ...((event.data as Record<string, unknown>) ?? {}), playerId: 0 },
      } as PlayerEvent
    }

    const meta = event.meta
    const resolvedEvent = { ...event } as PlayerEvent

    try {
      // Get the server's game type for player creation
      const serverGame = await this.serverService.getServerGame(event.serverId)

      // Handle single player events
      const playerMeta = meta as PlayerMeta
      if (playerMeta.steamId && playerMeta.playerName) {
        const playerId = await this.playerService.getOrCreatePlayer(
          playerMeta.steamId,
          playerMeta.playerName,
          serverGame,
        )
        resolvedEvent.data = { ...((event.data as Record<string, unknown>) ?? {}), playerId }
      }

      return resolvedEvent
    } catch (error) {
      this.logger.error(`Failed to resolve player IDs for event ${event.eventType}: ${error}`)
      return event as PlayerEvent // Return original event if resolution fails
    }
  }

  /**
   * Resolve player IDs for PLAYER_KILL events which contain both killer and victim information
   */
  private async resolveKillEventPlayerIds(event: BaseEvent): Promise<PlayerEvent> {
    try {
      const meta = event.meta as KillEventMeta
      if (!meta || !meta.killer || !meta.victim) {
        this.logger.error(`Missing meta data for PLAYER_KILL event`, { eventId: event.eventId })
        return event as PlayerEvent
      }

      // Get the server's game type for player creation
      const serverGame = await this.serverService.getServerGame(event.serverId)

      // Resolve both killer and victim player IDs
      const [killerId, victimId] = await Promise.all([
        this.playerService.getOrCreatePlayer(
          meta.killer.steamId,
          meta.killer.playerName,
          serverGame,
        ),
        this.playerService.getOrCreatePlayer(
          meta.victim.steamId,
          meta.victim.playerName,
          serverGame,
        ),
      ])

      // Create resolved event with database player IDs
      const resolvedEvent = {
        ...event,
        data: {
          ...(event.data as Record<string, unknown>),
          killerId,
          victimId,
        },
      } as PlayerEvent

      this.logger.debug(
        `Resolved PLAYER_KILL player IDs: killer ${meta.killer.steamId} -> ${killerId}, victim ${meta.victim.steamId} -> ${victimId}`,
      )

      return resolvedEvent
    } catch (error) {
      this.logger.error(`Failed to resolve PLAYER_KILL player IDs: ${error}`)
      return event as PlayerEvent // Return original event if resolution fails
    }
  }
}
