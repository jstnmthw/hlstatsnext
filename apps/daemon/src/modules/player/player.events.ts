/**
 * Player Module Event Handler
 *
 * Handles player-specific events including connections, disconnections,
 * name changes, and chat messages. This handler is responsible for
 * resolving player IDs and delegating to the player service.
 */

import { BaseModuleEventHandler } from "@/shared/infrastructure/module-event-handler.base"
import type { BaseEvent, PlayerMeta } from "@/shared/types/events"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { EventMetrics } from "@/shared/infrastructure/event-metrics"
import type { IPlayerService, PlayerEvent } from "@/modules/player/player.types"
import type { IServerService } from "@/modules/server/server.types"
import { EventType } from "@/shared/types/events"

export class PlayerEventHandler extends BaseModuleEventHandler {
  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    private readonly playerService: IPlayerService,
    private readonly serverService: IServerService,
    metrics?: EventMetrics,
  ) {
    super(eventBus, logger, metrics)
    this.registerEventHandlers()
  }

  registerEventHandlers(): void {
    // Simple player events (no cross-module coordination needed)
    this.registerHandler(EventType.PLAYER_CONNECT, this.handlePlayerConnect.bind(this))
    this.registerHandler(EventType.PLAYER_DISCONNECT, this.handlePlayerDisconnect.bind(this))
    this.registerHandler(EventType.PLAYER_CHANGE_NAME, this.handlePlayerChangeName.bind(this))
    this.registerHandler(EventType.CHAT_MESSAGE, this.handleChatMessage.bind(this))
  }

  private async handlePlayerConnect(event: BaseEvent): Promise<void> {
    this.logger.debug(`Player module handling PLAYER_CONNECT for server ${event.serverId}`)

    const resolvedEvent = await this.resolvePlayerIds(event)
    await this.playerService.handlePlayerEvent(resolvedEvent as PlayerEvent)
  }

  private async handlePlayerDisconnect(event: BaseEvent): Promise<void> {
    this.logger.debug(`Player module handling PLAYER_DISCONNECT for server ${event.serverId}`)

    const resolvedEvent = await this.resolvePlayerIds(event)
    await this.playerService.handlePlayerEvent(resolvedEvent as PlayerEvent)
  }

  private async handlePlayerChangeName(event: BaseEvent): Promise<void> {
    this.logger.debug(`Player module handling PLAYER_CHANGE_NAME for server ${event.serverId}`)

    const resolvedEvent = await this.resolvePlayerIds(event)
    await this.playerService.handlePlayerEvent(resolvedEvent as PlayerEvent)
  }

  private async handleChatMessage(event: BaseEvent): Promise<void> {
    this.logger.debug(`Player module handling CHAT_MESSAGE for server ${event.serverId}`)

    const resolvedEvent = await this.resolvePlayerIds(event)
    await this.playerService.handlePlayerEvent(resolvedEvent as PlayerEvent)
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
