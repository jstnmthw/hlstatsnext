/**
 * Event Processor
 *
 * Event handler that registers with the EventBus and orchestrates event processing.
 * Follows the Observer pattern for decoupled event handling.
 */

import type { BaseEvent, PlayerMeta, DualPlayerMeta } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IEventBus } from "@/shared/infrastructure/event-bus/event-bus.types"
import type { PlayerEvent, PlayerKillEvent } from "@/modules/player/player.types"
import type { WeaponEvent } from "@/modules/weapon/weapon.types"
import type { ActionEvent } from "@/modules/action/action.types"
import type { MatchEvent, ObjectiveEvent } from "@/modules/match/match.types"
import type { IPlayerService } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IWeaponService } from "@/modules/weapon/weapon.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IActionService } from "@/modules/action/action.types"
import type { IServerService } from "@/modules/server/server.types"
import { EventType } from "@/shared/types/events"

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
  ) {
    this.registerEventHandlers()
  }

  /**
   * Register event handlers with the event bus
   */
  private registerEventHandlers(): void {
    // Player events
    const playerEvents = [
      EventType.PLAYER_CONNECT,
      EventType.PLAYER_DISCONNECT,
      EventType.PLAYER_ENTRY,
      EventType.PLAYER_CHANGE_TEAM,
      EventType.PLAYER_CHANGE_ROLE,
      EventType.PLAYER_CHANGE_NAME,
      EventType.PLAYER_SUICIDE,
      EventType.PLAYER_TEAMKILL,
      EventType.CHAT_MESSAGE,
    ]

    for (const eventType of playerEvents) {
      const handlerId = this.eventBus.on(eventType, async (event) => {
        await this.handlePlayerEvent(event)
      })
      this.handlerIds.push(handlerId)
    }

    // Kill events
    const killHandlerId = this.eventBus.on(EventType.PLAYER_KILL, async (event) => {
      await this.handleKillEvent(event)
    })
    this.handlerIds.push(killHandlerId)

    // Match events
    const matchEvents = [
      EventType.ROUND_START,
      EventType.ROUND_END,
      EventType.TEAM_WIN,
      EventType.MAP_CHANGE,
    ]

    for (const eventType of matchEvents) {
      const handlerId = this.eventBus.on(eventType, async (event) => {
        await this.handleMatchEvent(event)
      })
      this.handlerIds.push(handlerId)
    }

    // Objective events
    const objectiveEvents = [
      EventType.BOMB_PLANT,
      EventType.BOMB_DEFUSE,
      EventType.BOMB_EXPLODE,
      EventType.HOSTAGE_RESCUE,
      EventType.HOSTAGE_TOUCH,
      EventType.FLAG_CAPTURE,
      EventType.FLAG_DEFEND,
      EventType.FLAG_PICKUP,
      EventType.FLAG_DROP,
      EventType.CONTROL_POINT_CAPTURE,
      EventType.CONTROL_POINT_DEFEND,
    ]

    for (const eventType of objectiveEvents) {
      const handlerId = this.eventBus.on(eventType, async (event) => {
        await this.handleObjectiveEvent(event)
      })
      this.handlerIds.push(handlerId)
    }

    // Weapon events
    const weaponEvents = [EventType.WEAPON_FIRE, EventType.WEAPON_HIT]

    for (const eventType of weaponEvents) {
      const handlerId = this.eventBus.on(eventType, async (event) => {
        await this.handleWeaponEvent(event)
      })
      this.handlerIds.push(handlerId)
    }

    // Action events
    const actionEvents = [
      EventType.ACTION_PLAYER,
      EventType.ACTION_PLAYER_PLAYER,
      EventType.ACTION_TEAM,
      EventType.ACTION_WORLD,
    ]

    for (const eventType of actionEvents) {
      const handlerId = this.eventBus.on(eventType, async (event) => {
        await this.handleActionEvent(event)
      })
      this.handlerIds.push(handlerId)
    }

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

  private async handleKillEvent(event: BaseEvent): Promise<void> {
    try {
      this.dependencies.logger.debug(`Processing kill event for server ${event.serverId}`)

      const resolvedEvent = await this.resolvePlayerIds(event)

      // Kill events involve multiple services
      await Promise.all([
        this.dependencies.playerService.handleKillEvent(resolvedEvent as PlayerKillEvent),
        this.dependencies.weaponService.handleWeaponEvent(resolvedEvent as WeaponEvent),
        this.dependencies.rankingService.handleRatingUpdate(),
        this.dependencies.matchService.handleKillInMatch(resolvedEvent),
      ])
    } catch (error) {
      this.dependencies.logger.error(`Failed to process kill event: ${error}`)
      throw error
    }
  }

  private async handleMatchEvent(event: BaseEvent): Promise<void> {
    try {
      this.dependencies.logger.debug(
        `Processing match event: ${event.eventType} for server ${event.serverId}`,
      )

      await this.dependencies.matchService.handleMatchEvent(event as MatchEvent)
    } catch (error) {
      this.dependencies.logger.error(`Failed to process match event ${event.eventType}: ${error}`)
      throw error
    }
  }

  private async handleObjectiveEvent(event: BaseEvent): Promise<void> {
    try {
      this.dependencies.logger.debug(
        `Processing objective event: ${event.eventType} for server ${event.serverId}`,
      )

      await this.dependencies.matchService.handleObjectiveEvent(event as ObjectiveEvent)
    } catch (error) {
      this.dependencies.logger.error(
        `Failed to process objective event ${event.eventType}: ${error}`,
      )
      throw error
    }
  }

  private async handleWeaponEvent(event: BaseEvent): Promise<void> {
    try {
      this.dependencies.logger.debug(
        `Processing weapon event: ${event.eventType} for server ${event.serverId}`,
      )

      await this.dependencies.weaponService.handleWeaponEvent(event as WeaponEvent)
    } catch (error) {
      this.dependencies.logger.error(`Failed to process weapon event ${event.eventType}: ${error}`)
      throw error
    }
  }

  private async handleActionEvent(event: BaseEvent): Promise<void> {
    try {
      const actionEvent = event as ActionEvent
      let playerInfo = ""

      // Add player information to the log based on event type
      if (actionEvent.eventType === EventType.ACTION_PLAYER && "playerId" in actionEvent.data) {
        playerInfo = `, playerId=${actionEvent.data.playerId}`
      } else if (
        actionEvent.eventType === EventType.ACTION_PLAYER_PLAYER &&
        "playerId" in actionEvent.data
      ) {
        playerInfo = `, playerId=${actionEvent.data.playerId}, victimId=${actionEvent.data.victimId}`
      }

      this.dependencies.logger.debug(
        `Processing action event: ${event.eventType} for server ${event.serverId}${playerInfo}`,
      )

      await this.dependencies.actionService.handleActionEvent(actionEvent)
    } catch (error) {
      this.dependencies.logger.error(`Failed to process action event ${event.eventType}: ${error}`)
      throw error
    }
  }

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
