/**
 * Player Teamkill Event Handler
 *
 * Handles teamkill events including both killer and victim stat updates
 * and event logging.
 */

import { BasePlayerEventHandler } from "./base-player-event.handler"
import { EventType } from "@/shared/types/events"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import { PlayerNameUpdateBuilder } from "@/shared/application/utils/player-name-update.builder"
import type { HandlerResult } from "@/shared/types/common"
import type { PlayerEvent, PlayerTeamkillEvent } from "@/modules/player/types/player.types"
import type { DualPlayerMeta } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/types/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IMapService } from "@/modules/map/map.service"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IEventNotificationService } from "@/modules/rcon/services/event-notification.service"

export class TeamkillEventHandler extends BasePlayerEventHandler {
  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    matchService: IMatchService | undefined,
    mapService?: IMapService,
    private readonly rankingService?: IRankingService,
    private readonly eventNotificationService?: IEventNotificationService,
  ) {
    super(repository, logger, matchService, mapService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_TEAMKILL) {
        return this.createErrorResult("Invalid event type for TeamkillEventHandler")
      }

      const teamkillEvent = event as PlayerTeamkillEvent
      const { killerId, victimId, headshot } = teamkillEvent.data

      // Calculate skill penalty for teamkill
      const skillPenalty = this.rankingService?.calculateTeamkillPenalty() || -5

      // Build killer stats update
      const killerUpdateBuilder = StatUpdateBuilder.create()
        .addTeamkills(1)
        .addSkillChange(skillPenalty) // Apply penalty to killer
        .updateLastEvent()

      if (headshot) {
        killerUpdateBuilder.addHeadshots(1)
      }

      // Build victim stats update
      const victimUpdateBuilder = StatUpdateBuilder.create().addDeaths(1).updateLastEvent()

      // Get current map and create event log
      const map = await this.getCurrentMap(event.serverId)

      // Execute all updates in parallel
      await Promise.all([
        this.repository.createTeamkillEvent?.(
          killerId,
          victimId,
          event.serverId,
          map,
          teamkillEvent.data.weapon,
        ) ?? Promise.resolve(),
        this.repository.update(killerId, killerUpdateBuilder.build()),
        this.repository.update(victimId, victimUpdateBuilder.build()),
      ])

      // Update player name stats
      await this.updatePlayerNameStats(killerId, victimId, event.meta as DualPlayerMeta)

      // Send teamkill notification
      await this.sendTeamkillNotification(event, skillPenalty)

      this.logger.debug(`Teamkill: ${killerId} → ${victimId} (${teamkillEvent.data.weapon})`)

      return this.createSuccessResult(2) // Affected both killer and victim
    })
  }

  /**
   * Send teamkill event notification
   */
  private async sendTeamkillNotification(event: PlayerEvent, skillPenalty: number): Promise<void> {
    if (!this.eventNotificationService) {
      return
    }

    try {
      const teamkillEvent = event as PlayerTeamkillEvent
      const { killerId, victimId, headshot } = teamkillEvent.data
      const meta = event.meta as DualPlayerMeta

      await this.eventNotificationService.notifyTeamKillEvent({
        serverId: event.serverId,
        killerId,
        victimId,
        killerName: meta?.killer?.playerName,
        victimName: meta?.victim?.playerName,
        weapon: teamkillEvent.data.weapon,
        headshot,
        skillPenalty,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.warn(`Failed to send teamkill notification: ${error}`)
    }
  }

  /**
   * Update player name statistics for both killer and victim
   */
  private async updatePlayerNameStats(
    killerId: number,
    victimId: number,
    meta?: DualPlayerMeta,
  ): Promise<void> {
    try {
      const now = new Date()
      const operations: Array<Promise<void>> = []

      // Update killer name (just mark as used)
      if (meta?.killer?.playerName) {
        const killerNameUpdate = PlayerNameUpdateBuilder.create().updateLastUse(now)
        operations.push(
          this.repository.upsertPlayerName(
            killerId,
            meta.killer.playerName,
            killerNameUpdate.build(),
          ),
        )
      }

      // Update victim name (increment deaths)
      if (meta?.victim?.playerName) {
        const victimNameUpdate = PlayerNameUpdateBuilder.forDeath()
        operations.push(
          this.repository.upsertPlayerName(
            victimId,
            meta.victim.playerName,
            victimNameUpdate.build(),
          ),
        )
      }

      if (operations.length > 0) {
        await Promise.all(operations)
      }
    } catch (error) {
      this.logger.warn(`Failed to update player names on teamkill: ${error}`)
    }
  }
}
