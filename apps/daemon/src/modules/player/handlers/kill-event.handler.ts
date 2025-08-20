/**
 * Player Kill Event Handler
 *
 * Handles player kill events including skill calculations, streak tracking,
 * stat updates for both killer and victim, and event logging.
 */

import { BasePlayerEventHandler } from "./base-player-event.handler"
import { EventType } from "@/shared/types/events"
import { StatUpdateBuilder } from "@/shared/application/utils/stat-update.builder"
import { PlayerNameUpdateBuilder } from "@/shared/application/utils/player-name-update.builder"
import type { HandlerResult } from "@/shared/types/common"
import type { PlayerEvent, PlayerKillEvent, SkillRating } from "@/modules/player/player.types"
import type { Player } from "@repo/database/client"
import type { DualPlayerMeta } from "@/shared/types/events"
import type { KillContext } from "@/modules/ranking/ranking.service"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IPlayerRepository } from "@/modules/player/player.types"
import type { IMatchService } from "@/modules/match/match.types"
import type { IRankingService } from "@/modules/ranking/ranking.types"

export class KillEventHandler extends BasePlayerEventHandler {
  private readonly DEFAULT_RATING = 1000
  private readonly DEFAULT_VOLATILITY = 0.06

  constructor(
    repository: IPlayerRepository,
    logger: ILogger,
    matchService: IMatchService | undefined,
    private readonly rankingService: IRankingService,
  ) {
    super(repository, logger, matchService)
  }

  async handle(event: PlayerEvent): Promise<HandlerResult> {
    return this.safeHandle(event, async () => {
      if (event.eventType !== EventType.PLAYER_KILL) {
        return this.createErrorResult("Invalid event type for KillEventHandler")
      }

      const killEvent = event as PlayerKillEvent
      const { killerId, victimId, headshot, weapon, killerTeam, victimTeam } = killEvent.data

      // Update match teams if known
      this.updateMatchTeams(event.serverId, killerId, victimId, killerTeam, victimTeam)

      // Get current player stats for both players
      let killerStats: Player
      let victimStats: Player

      try {
        ;[killerStats, victimStats] = await this.getPlayerStats(killerId, victimId)
      } catch {
        // Handle missing players gracefully - log warning but return success
        this.logger.warn(
          `Kill event skipped: missing player stats for killer ${killerId} or victim ${victimId}`,
        )
        return this.createSuccessResult()
      }

      // Calculate skill adjustments
      const skillAdjustment = await this.calculateSkillAdjustment(
        killerId,
        victimId,
        killerStats,
        victimStats,
        weapon,
        headshot,
        killerTeam,
        victimTeam,
      )

      // Build stat updates for both players
      const { killerUpdate, victimUpdate } = this.buildStatUpdates(
        killerStats,
        victimStats,
        skillAdjustment,
        headshot,
        killerTeam === victimTeam,
      )

      // Apply stat updates and log the kill event
      await this.applyUpdatesAndLogging(
        killerId,
        victimId,
        event.serverId,
        killerUpdate,
        victimUpdate,
        weapon,
        headshot,
      )

      // Update player name statistics
      await this.updatePlayerNameStats(killerId, victimId, killEvent.meta, headshot)

      // Log skill calculation results
      this.logSkillCalculation(
        killerId,
        victimId,
        event.serverId,
        killerStats,
        victimStats,
        skillAdjustment,
      )

      return this.createSuccessResult(2) // Affected both killer and victim
    })
  }

  /**
   * Update in-memory match team assignments
   */
  private updateMatchTeams(
    serverId: number,
    killerId: number,
    victimId: number,
    killerTeam?: string,
    victimTeam?: string,
  ): void {
    if (killerTeam) {
      this.matchService?.setPlayerTeam?.(serverId, killerId, killerTeam)
    }
    if (victimTeam) {
      this.matchService?.setPlayerTeam?.(serverId, victimId, victimTeam)
    }
  }

  /**
   * Get current stats for both killer and victim
   */
  private async getPlayerStats(killerId: number, victimId: number): Promise<[Player, Player]> {
    const [killerStats, victimStats] = await Promise.all([
      this.repository.getPlayerStats(killerId),
      this.repository.getPlayerStats(victimId),
    ])

    if (!killerStats || !victimStats) {
      this.logger.warn(
        `Kill event ignored: missing player stats for killer ${killerId} or victim ${victimId}`,
      )
      throw new Error("Unable to retrieve player stats for skill calculation")
    }

    return [killerStats, victimStats]
  }

  /**
   * Calculate skill adjustments using the ranking service
   */
  private async calculateSkillAdjustment(
    killerId: number,
    victimId: number,
    killerStats: Player,
    victimStats: Player,
    weapon?: string,
    headshot?: boolean,
    killerTeam?: string,
    victimTeam?: string,
  ): Promise<{ killerChange: number; victimChange: number }> {
    const killContext: KillContext = {
      weapon: weapon || "unknown",
      headshot: headshot || false,
      killerTeam: killerTeam || "UNKNOWN",
      victimTeam: victimTeam || "UNKNOWN",
    }

    const killerRating: SkillRating = {
      playerId: killerId,
      rating: killerStats.skill || this.DEFAULT_RATING,
      confidence: 1.0, // TODO: Implement confidence tracking
      volatility: this.DEFAULT_VOLATILITY,
      gamesPlayed: killerStats.kills + killerStats.deaths,
    }

    const victimRating: SkillRating = {
      playerId: victimId,
      rating: victimStats.skill || this.DEFAULT_RATING,
      confidence: 1.0,
      volatility: this.DEFAULT_VOLATILITY,
      gamesPlayed: victimStats.kills + victimStats.deaths,
    }

    return await this.rankingService.calculateSkillAdjustment(
      killerRating,
      victimRating,
      killContext,
    )
  }

  /**
   * Build stat updates for both killer and victim
   */
  private buildStatUpdates(
    killerStats: Player,
    victimStats: Player,
    skillAdjustment: { killerChange: number; victimChange: number },
    headshot?: boolean,
    isTeamkill: boolean = false,
  ): {
    killerUpdate: ReturnType<StatUpdateBuilder["build"]>
    victimUpdate: ReturnType<StatUpdateBuilder["build"]>
  } {
    const newKillerKillStreak = (killerStats.killStreak || 0) + 1
    const newVictimDeathStreak = (victimStats.deathStreak || 0) + 1

    // Build killer updates
    const killerUpdateBuilder = StatUpdateBuilder.create()
      .addKills(1)
      .addSkillChange(skillAdjustment.killerChange)
      .setKillStreak(newKillerKillStreak)
      .resetDeathStreak()
      .updateLastEvent()

    if (headshot) {
      killerUpdateBuilder.addHeadshots(1)
    }

    // Handle team kills
    if (isTeamkill) {
      killerUpdateBuilder.addTeamkills(1)
      this.logger.warn(`Team kill: ${killerStats.playerId} -> ${victimStats.playerId}`)
    }

    // Build victim updates
    const victimUpdateBuilder = StatUpdateBuilder.create()
      .addDeaths(1)
      .addSkillChange(skillAdjustment.victimChange)
      .setDeathStreak(newVictimDeathStreak)
      .resetKillStreak()
      .updateLastEvent()

    return {
      killerUpdate: killerUpdateBuilder.build(),
      victimUpdate: victimUpdateBuilder.build(),
    }
  }

  /**
   * Apply stat updates and create event logs
   */
  private async applyUpdatesAndLogging(
    killerId: number,
    victimId: number,
    serverId: number,
    killerUpdate: ReturnType<StatUpdateBuilder["build"]>,
    victimUpdate: ReturnType<StatUpdateBuilder["build"]>,
    weapon?: string,
    headshot?: boolean,
  ): Promise<void> {
    // Get current map
    const map = await this.getCurrentMap(serverId)

    // Apply all updates in parallel
    await Promise.all([
      this.repository.update(killerId, killerUpdate),
      this.repository.update(victimId, victimUpdate),
      // Log EventFrag for historical tracking
      this.repository.logEventFrag(
        killerId,
        victimId,
        serverId,
        map,
        weapon || "unknown",
        headshot || false,
        undefined, // killerRole - TODO: Get from player roles
        undefined, // victimRole - TODO: Get from player roles
        // Position data from event if available
        undefined, // killerX - TODO: Extract from event.data positions
        undefined, // killerY
        undefined, // killerZ
        undefined, // victimX
        undefined, // victimY
        undefined, // victimZ
      ),
    ])
  }

  /**
   * Update player name statistics for both killer and victim
   */
  private async updatePlayerNameStats(
    killerId: number,
    victimId: number,
    meta?: DualPlayerMeta,
    headshot?: boolean,
  ): Promise<void> {
    try {
      const operations: Array<Promise<void>> = []

      // Update killer name stats
      if (meta?.killer?.playerName) {
        const killerNameUpdate = PlayerNameUpdateBuilder.forKill(headshot)
        operations.push(
          this.repository.upsertPlayerName(
            killerId,
            meta.killer.playerName,
            killerNameUpdate.build(),
          ),
        )
      }

      // Update victim name stats
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
      this.logger.warn(`Failed to update player names on kill: ${error}`)
    }
  }

  /**
   * Log skill calculation results for visibility
   */
  private logSkillCalculation(
    killerId: number,
    victimId: number,
    serverId: number,
    killerStats: Player,
    victimStats: Player,
    skillAdjustment: { killerChange: number; victimChange: number },
  ): void {
    this.logger.debug(`Kill event: ${killerId} → ${victimId} (weapon: ${skillAdjustment})`)

    // Log skill calculation results at INFO level for visibility
    this.logger.info(
      `Skill calculated: killer ${killerId} (${skillAdjustment.killerChange > 0 ? "+" : ""}${
        skillAdjustment.killerChange
      }) -> victim ${victimId} (${skillAdjustment.victimChange})`,
      {
        eventType: "PLAYER_KILL",
        serverId,
        killerId,
        victimId,
        killerOldRating: killerStats.skill || this.DEFAULT_RATING,
        killerNewRating: (killerStats.skill || this.DEFAULT_RATING) + skillAdjustment.killerChange,
        victimOldRating: victimStats.skill || this.DEFAULT_RATING,
        victimNewRating: (victimStats.skill || this.DEFAULT_RATING) + skillAdjustment.victimChange,
      },
    )
  }
}
