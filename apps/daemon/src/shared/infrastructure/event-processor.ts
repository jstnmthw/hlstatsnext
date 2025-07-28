/**
 * Event Processor (Legacy Coordinator)
 *
 * Handles complex events that require cross-module coordination.
 * Most simple events have been migrated to individual module handlers.
 * This processor now focuses on orchestration and saga execution.
 */

import type { BaseEvent, PlayerMeta, DualPlayerMeta } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { PlayerEvent } from "@/modules/player/player.types"
import type { IPlayerService } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IWeaponService } from "@/modules/weapon/weapon.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IActionService } from "@/modules/action/action.types"
import type { IServerService } from "@/modules/server/server.types"
import { EventType } from "@/shared/types/events"
import type { EventCoordinator } from "@/shared/application/event-coordinator"

/**
 * Dependencies required by the EventProcessor
 */
export interface EventProcessorDependencies {
  readonly playerService: IPlayerService
  readonly matchService: IMatchService
  readonly weaponService: IWeaponService
  readonly rankingService: IRankingService
  readonly actionService: IActionService
  readonly serverService: IServerService
  readonly logger: ILogger
}

export class EventProcessor {
  private readonly handlerIds: string[] = []

  constructor(
    private readonly eventBus: IEventBus,
    private readonly dependencies: EventProcessorDependencies,
    private readonly coordinators: EventCoordinator[] = [],
  ) {
    this.registerEventHandlers()
  }

  /**
   * Register event handlers with the event bus
   */
  private registerEventHandlers(): void {
    // Only handle EventBus fallback events (not migrated to queue-only)
    const eventBusFallbackEvents = [
      EventType.PLAYER_ENTRY,
      EventType.PLAYER_CHANGE_TEAM,
      EventType.PLAYER_CHANGE_ROLE,
      // Note: PLAYER_SUICIDE, PLAYER_TEAMKILL, PLAYER_KILL are now queue-only
    ]

    for (const eventType of eventBusFallbackEvents) {
      const handlerId = this.eventBus.on(eventType, async (event) => {
        await this.handlePlayerEvent(event)
      })
      this.handlerIds.push(handlerId)
    }

    // Note: PLAYER_KILL is now handled by queue-only processing via RabbitMQConsumer

    this.dependencies.logger.info(
      `EventProcessor registered ${this.handlerIds.length} event handlers`,
    )
  }

  /**
   * Unregister all event handlers
   */
  destroy(): void {
    for (const handlerId of this.handlerIds) {
      this.eventBus.off(handlerId)
    }
    this.handlerIds.length = 0
    this.dependencies.logger.info("EventProcessor unregistered all event handlers")
  }

  /**
   * Run event coordinators for cross-module concerns
   */
  private async runCoordinators(event: BaseEvent): Promise<void> {
    for (const coordinator of this.coordinators) {
      try {
        await coordinator.coordinateEvent(event)
      } catch (error) {
        this.dependencies.logger.error(
          `Coordinator ${coordinator.constructor.name} failed for event ${event.eventType}: ${error}`,
        )
        // Decide: throw or continue with other coordinators
        // For now, we throw to maintain existing error handling behavior
        throw error
      }
    }
  }

  private async handlePlayerEvent(event: BaseEvent): Promise<void> {
    try {
      this.dependencies.logger.debug(
        `Processing player event: ${event.eventType} for server ${event.serverId}`,
      )

      const resolvedEvent = await this.resolvePlayerIds(event)
      await this.dependencies.playerService.handlePlayerEvent(resolvedEvent as PlayerEvent)
    } catch (error) {
      this.dependencies.logger.error(`Failed to process player event ${event.eventType}: ${error}`)
      throw error
    }
  }

  // handleKillEvent removed - now handled by queue-only processing via RabbitMQConsumer

  /**
   * Emit multiple events to the event bus
   */
  async emitEvents(events: BaseEvent[]): Promise<void> {
    for (const event of events) {
      await this.eventBus.emit(event)
    }
  }

  /**
   * Resolve Steam IDs to database player IDs for events that contain player references
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
      const serverGame = await this.dependencies.serverService.getServerGame(event.serverId)
      // Handle PLAYER_KILL events
      if (event.eventType === EventType.PLAYER_KILL) {
        const dualMeta = meta as DualPlayerMeta
        if (dualMeta.killer?.steamId && dualMeta.killer?.playerName) {
          const killerId = await this.dependencies.playerService.getOrCreatePlayer(
            dualMeta.killer.steamId,
            dualMeta.killer.playerName,
            serverGame,
          )
          resolvedEvent.data = { ...((event.data as Record<string, unknown>) ?? {}), killerId }
        }

        if (dualMeta.victim?.steamId && dualMeta.victim?.playerName) {
          const victimId = await this.dependencies.playerService.getOrCreatePlayer(
            dualMeta.victim.steamId,
            dualMeta.victim.playerName,
            serverGame,
          )
          resolvedEvent.data = {
            ...((resolvedEvent.data as Record<string, unknown>) ?? {}),
            victimId,
          }
        }
      }

      // Handle single player events (PLAYER_CONNECT, PLAYER_DISCONNECT, etc.)
      else {
        const playerMeta = meta as PlayerMeta
        if (playerMeta.steamId && playerMeta.playerName) {
          const playerId = await this.dependencies.playerService.getOrCreatePlayer(
            playerMeta.steamId,
            playerMeta.playerName,
            serverGame,
          )
          resolvedEvent.data = { ...((event.data as Record<string, unknown>) ?? {}), playerId }
        }
      }

      return resolvedEvent
    } catch (error) {
      this.dependencies.logger.error(
        `Failed to resolve player IDs for event ${event.eventType}: ${error}`,
      )
      return event // Return original event if resolution fails
    }
  }
}
