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
import type { IPlayerService } from "@/modules/player/player.types"
import type { IServerService } from "@/modules/server/server.types"

export class PlayerEventHandler extends BaseModuleEventHandler {
  constructor(
    logger: ILogger,
    private readonly playerService: IPlayerService,
    private readonly serverService: IServerService,
    metrics?: EventMetrics,
  ) {
    super(logger, metrics)
    this.registerEventHandlers()
  }

  registerEventHandlers(): void {
    // Note: All simple player events have been migrated to queue-only processing
    // - PLAYER_CONNECT, PLAYER_DISCONNECT, PLAYER_CHANGE_NAME, CHAT_MESSAGE
    // These are now handled via RabbitMQConsumer and no longer use EventBus
  }

  // Queue-compatible handler methods (called by RabbitMQConsumer)
  async handlePlayerConnect(event: BaseEvent): Promise<void> {
    const resolvedEvent = await this.resolvePlayerIds(event)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.playerService.handlePlayerEvent(resolvedEvent as any)
  }

  async handlePlayerDisconnect(event: BaseEvent): Promise<void> {
    const resolvedEvent = await this.resolvePlayerIds(event)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.playerService.handlePlayerEvent(resolvedEvent as any)
  }

  async handlePlayerChangeName(event: BaseEvent): Promise<void> {
    const resolvedEvent = await this.resolvePlayerIds(event)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.playerService.handlePlayerEvent(resolvedEvent as any)
  }

  async handleChatMessage(event: BaseEvent): Promise<void> {
    const resolvedEvent = await this.resolvePlayerIds(event)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.playerService.handlePlayerEvent(resolvedEvent as any)
  }

  /**
   * Resolve Steam IDs to database player IDs for events that contain player references
   * This is moved from EventProcessor to make the player module self-contained
   */
  private async resolvePlayerIds(event: BaseEvent): Promise<BaseEvent> {
    // Only resolve for events that have player data
    if (!event.meta || typeof event.meta !== "object") {
      return event
    }

    const meta = event.meta
    const resolvedEvent = { ...event }

    if (!meta || typeof meta !== "object") {
      return event
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
      return event // Return original event if resolution fails
    }
  }
}
