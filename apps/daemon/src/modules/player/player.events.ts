/**
 * Player Module Event Handler
 *
 * Handles player-specific events including connections, disconnections,
 * name changes, and chat messages. This handler is responsible for
 * resolving player IDs and delegating to the player service.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/modules/event-handler.base"
import type { BaseEvent, PlayerMeta } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/observability/event-metrics"
import type { IPlayerService, PlayerEvent } from "@/modules/player/player.types"
import type { IServerService } from "@/modules/server/server.types"

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
    // Only resolve for events that have player data
    if (!event.meta || typeof event.meta !== "object") {
      // For events without meta, create a minimal resolved event with just playerId if needed
      return {
        ...event,
        data: { ...((event.data as Record<string, unknown>) ?? {}), playerId: 0 },
      } as PlayerEvent
    }

    const meta = event.meta
    const resolvedEvent = { ...event } as PlayerEvent

    if (!meta || typeof meta !== "object") {
      return event as PlayerEvent
    }

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
}
