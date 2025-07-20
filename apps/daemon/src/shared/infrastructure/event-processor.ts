/**
 * Event Processor
 *
 * Clean event orchestration that delegates to appropriate modules.
 * Replaces the complex EventProcessorService with pure orchestration logic.
 */

import type { AppContext } from "@/context"
import type { BaseEvent } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger"
import type { PlayerEvent } from "@/modules/player/player.types"
import type { WeaponEvent } from "@/modules/weapon/weapon.types"
import type { ActionEvent } from "@/modules/action/action.types"
import type { MatchEvent, ObjectiveEvent } from "@/modules/match/match.types"
import { EventType } from "@/shared/types/events"

export class EventProcessor {
  private readonly logger: ILogger

  constructor(private readonly context: AppContext) {
    this.logger = context.logger
  }

  async processEvent(event: BaseEvent): Promise<void> {
    const { playerService, matchService, weaponService, rankingService, actionService } =
      this.context

    try {
      // Log event for debugging
      this.logger.info(`Processing event: ${event.eventType} for server ${event.serverId}`)

      // Route to appropriate modules based on event type
      switch (event.eventType) {
        // Player events
        case EventType.PLAYER_CONNECT:
        case EventType.PLAYER_DISCONNECT:
        case EventType.PLAYER_ENTRY:
        case EventType.PLAYER_CHANGE_TEAM:
        case EventType.PLAYER_CHANGE_ROLE:
        case EventType.PLAYER_CHANGE_NAME:
        case EventType.PLAYER_SUICIDE:
        case EventType.PLAYER_TEAMKILL:
        case EventType.CHAT_MESSAGE:
          await playerService.handlePlayerEvent(event as PlayerEvent)
          break

        // Kill events - multiple modules involved
        case EventType.PLAYER_KILL:
          await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            playerService.handleKillEvent(event as any),
            weaponService.handleWeaponEvent(event as WeaponEvent),
            rankingService.handleRatingUpdate(),
            matchService.handleKillInMatch(event),
          ])
          break

        // Match events
        case EventType.ROUND_START:
        case EventType.ROUND_END:
        case EventType.TEAM_WIN:
        case EventType.MAP_CHANGE:
          await matchService.handleMatchEvent(event as MatchEvent)
          break

        // Objective events
        case EventType.BOMB_PLANT:
        case EventType.BOMB_DEFUSE:
        case EventType.BOMB_EXPLODE:
        case EventType.HOSTAGE_RESCUE:
        case EventType.HOSTAGE_TOUCH:
        case EventType.FLAG_CAPTURE:
        case EventType.FLAG_DEFEND:
        case EventType.FLAG_PICKUP:
        case EventType.FLAG_DROP:
        case EventType.CONTROL_POINT_CAPTURE:
        case EventType.CONTROL_POINT_DEFEND:
          await matchService.handleObjectiveEvent(event as ObjectiveEvent)
          break

        // Weapon events
        case EventType.WEAPON_FIRE:
        case EventType.WEAPON_HIT:
          await weaponService.handleWeaponEvent(event as WeaponEvent)
          break

        // Action events
        case EventType.ACTION_PLAYER:
        case EventType.ACTION_PLAYER_PLAYER:
        case EventType.ACTION_TEAM:
        case EventType.ACTION_WORLD:
          await actionService.handleActionEvent(event as ActionEvent)
          break

        // Server events
        case EventType.SERVER_STATS_UPDATE:
          // Server stats events are typically handled by ingress or dedicated handlers
          this.logger.debug(`Server stats update event for server ${event.serverId}`)
          break

        case EventType.SERVER_SHUTDOWN:
        case EventType.ADMIN_ACTION:
          // These events might not need processing or have dedicated handlers
          this.logger.info(`System event: ${event.eventType}`)
          break

        default:
          this.logger.warn(`Unhandled event type: ${event.eventType}`)
      }

      this.logger.debug(`Event processed successfully: ${event.eventType}`)
    } catch (error) {
      this.logger.error(`Failed to process event ${event.eventType}: ${error}`)
      throw error
    }
  }

  /**
   * Process multiple events in sequence
   */
  async processEvents(events: BaseEvent[]): Promise<void> {
    for (const event of events) {
      await this.processEvent(event)
    }
  }

  /**
   * Process events with concurrency control
   */
  async processEventsConcurrent(events: BaseEvent[], concurrency: number = 10): Promise<void> {
    const promises: Promise<void>[] = []

    for (const event of events) {
      promises.push(this.processEvent(event))

      // Control concurrency
      if (promises.length >= concurrency) {
        await Promise.all(promises)
        promises.length = 0
      }
    }

    // Process remaining events
    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }
}
