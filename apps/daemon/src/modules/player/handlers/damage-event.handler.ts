/**
 * Player Damage Event Handler
 *
 * Handles player damage events including accuracy tracking
 * and hit statistics.
 */

import { BasePlayerEventHandler } from "./base-player-event.handler"
import { EventType } from "@/shared/types/events"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import { PlayerNameUpdateBuilder } from "@/shared/application/utils/player-name-update.builder"
import type { HandlerResult } from "@/shared/types/common"
import type { PlayerEvent, PlayerDamageEvent } from "@/modules/player/types/player.types"
import type { PlayerMeta, DualPlayerMeta } from "@/shared/types/events"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/types/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IMapService } from "@/modules/map/map.service"

export class DamageEventHandler extends BasePlayerEventHandler {
  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    matchService?: IMatchService,
    mapService?: IMapService,
  ) {
    super(repository, logger, matchService, mapService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_DAMAGE) {
        return this.createErrorResult("Invalid event type for DamageEventHandler")
      }

      const damageEvent = event as PlayerDamageEvent
      const { attackerId, victimId, weapon, damage, hitgroup } = damageEvent.data

      // Build attacker stats update
      const isHeadshot = hitgroup === "head"
      const updateBuilder = StatUpdateBuilder.create()
        .addShots(1) // Each damage event counts as a shot that hit
        .addHits(1)
        .updateLastEvent()

      if (isHeadshot) {
        updateBuilder.addHeadshots(1)
      }

      // Update attacker stats
      await this.repository.update(attackerId, updateBuilder.build())

      // Update attacker name stats
      await this.updateAttackerNameStats(attackerId, event.meta, isHeadshot)

      this.logger.debug(
        `Damage: ${attackerId} → ${victimId} (${damage} damage with ${weapon}, hitgroup: ${hitgroup})`,
      )

      return this.createSuccessResult()
    })
  }

  /**
   * Update attacker's name statistics for damage event
   */
  private async updateAttackerNameStats(
    attackerId: number,
    meta?: PlayerMeta | DualPlayerMeta,
    isHeadshot: boolean = false,
  ): Promise<void> {
    try {
      // Handle damage events which use DualPlayerMeta - extract attacker info
      const attackerMeta = meta && "killer" in meta ? meta.killer : meta
      const currentName = attackerMeta?.playerName
      if (currentName) {
        const nameUpdate = PlayerNameUpdateBuilder.forDamage(isHeadshot)
        await this.repository.upsertPlayerName(attackerId, currentName, nameUpdate.build())
      }
    } catch (error) {
      this.logger.warn(`Failed to update player name on damage: ${error}`)
    }
  }
}
