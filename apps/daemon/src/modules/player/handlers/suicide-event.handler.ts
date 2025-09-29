/**
 * Player Suicide Event Handler
 *
 * Handles player suicide events including skill penalties,
 * streak updates, and event logging.
 */

import { BasePlayerEventHandler } from "./base-player-event.handler"
import { EventType } from "@/shared/types/events"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import { PlayerNameUpdateBuilder } from "@/shared/application/utils/player-name-update.builder"
import type { HandlerResult } from "@/shared/types/common"
import type { PlayerEvent, PlayerSuicideEvent } from "@/modules/player/types/player.types"
import type { PlayerMeta } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/types/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IMapService } from "@/modules/map/map.service"
import type { IRankingService } from "@/modules/ranking/ranking.types"
import type { IEventNotificationService } from "@/modules/rcon/services/event-notification.service"

export class SuicideEventHandler extends BasePlayerEventHandler {
  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    private readonly rankingService: IRankingService,
    matchService: IMatchService | undefined,
    mapService?: IMapService,
    private readonly eventNotificationService?: IEventNotificationService,
  ) {
    super(repository, logger, matchService, mapService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_SUICIDE) {
        return this.createErrorResult("Invalid event type for SuicideEventHandler")
      }

      const suicideEvent = event as PlayerSuicideEvent
      const { playerId } = suicideEvent.data

      // Get current player stats for streak calculation
      const playerStats = await this.repository.getPlayerStats(playerId)
      if (!playerStats) {
        return this.createErrorResult("Unable to retrieve player stats for suicide processing")
      }

      // Calculate skill penalty
      const skillPenalty = this.rankingService.calculateSuicidePenalty()

      // Build player stats update
      const newDeathStreak = (playerStats.deathStreak || 0) + 1
      const updateBuilder = StatUpdateBuilder.create()
        .addSuicides(1)
        .addDeaths(1) // Suicide also counts as death
        .addSkillChange(skillPenalty)
        .setDeathStreak(newDeathStreak)
        .resetKillStreak() // Reset kill streak on death
        .updateLastEvent()

      // Update player stats
      await this.repository.update(playerId, updateBuilder.build())

      // Update player name stats
      await this.updatePlayerNameStats(playerId, event.meta as PlayerMeta)

      // Create suicide event log
      await this.createSuicideEventLog(playerId, event.serverId, suicideEvent.data.weapon)

      // Update server stats
      await this.updateServerStats(event.serverId)

      // Send suicide notification (get skill after penalty is applied)
      await this.sendSuicideNotification(event, skillPenalty)

      this.logger.debug(`Player suicide: ${playerId} (penalty: ${skillPenalty})`)

      return this.createSuccessResult()
    })
  }

  /**
   * Send suicide event notification
   */
  private async sendSuicideNotification(event: PlayerEvent, skillPenalty: number): Promise<void> {
    if (!this.eventNotificationService) {
      return
    }

    try {
      const suicideEvent = event as PlayerSuicideEvent
      const { playerId } = suicideEvent.data
      const playerName = (event.meta as PlayerMeta)?.playerName

      // Get current player skill after penalty has been applied
      const playerStats = await this.repository.getPlayerStats(playerId)
      const playerSkill = playerStats?.skill || 1000

      await this.eventNotificationService.notifySuicideEvent({
        serverId: event.serverId,
        playerId,
        playerName,
        playerSkill,
        weapon: suicideEvent.data.weapon,
        skillPenalty,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.warn(`Failed to send suicide notification: ${error}`)
    }
  }

  /**
   * Update player name statistics for suicide
   */
  private async updatePlayerNameStats(playerId: number, meta?: PlayerMeta): Promise<void> {
    try {
      const currentName = meta?.playerName
      if (currentName) {
        const nameUpdate = PlayerNameUpdateBuilder.forSuicide()
        await this.repository.upsertPlayerName(playerId, currentName, nameUpdate.build())
      }
    } catch (error) {
      this.logger.warn(`Failed to update player name on suicide for ${playerId}: ${error}`)
    }
  }

  /**
   * Create suicide event log
   */
  private async createSuicideEventLog(
    playerId: number,
    serverId: number,
    weapon?: string,
  ): Promise<void> {
    try {
      const map = await this.getCurrentMap(serverId)
      await this.repository.createSuicideEvent?.(playerId, serverId, map, weapon)
    } catch {
      this.logger.error(
        `Failed to create suicide event for player ${playerId} on server ${serverId}`,
      )
    }
  }

  /**
   * Update server suicide stats
   */
  private async updateServerStats(serverId: number): Promise<void> {
    try {
      await this.repository.updateServerForPlayerEvent?.(serverId, {
        suicides: { increment: 1 },
        lastEvent: new Date(),
      })
    } catch {
      // Ignore optional hook if not available
      this.logger.debug(`Server suicide stats update not available for server ${serverId}`)
    }
  }
}
