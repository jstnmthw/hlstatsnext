/**
 * Weapon Event Handler
 *
 * Processes weapon-related events and updates weapon statistics,
 * accuracy tracking, and weapon usage patterns.
 */

import type { GameEvent, PlayerKillEvent } from "@/types/common/events"
import type { IWeaponService } from "@/services/weapon/weapon.types"
import type { DatabaseClient } from "@/database/client"
import { getWeaponAttributes } from "@/config/weapon-config"
import type { ILogger } from "@/utils/logger.types"
import type { 
  IWeaponHandler, 
  HandlerResult, 
  WeaponStats, 
  PlayerWeaponStats 
} from "./weapon.handler.types"


export class WeaponHandler implements IWeaponHandler {
  constructor(
    private readonly weaponService: IWeaponService,
    private readonly db: DatabaseClient,
    private readonly logger: ILogger,
  ) {}

  async handleEvent(event: GameEvent): Promise<HandlerResult> {
    switch (event.eventType) {
      case "PLAYER_KILL":
        return this.handleWeaponKill(event)

      default:
        return { success: true } // Event not handled by this handler
    }
  }

  protected async handleWeaponKill(event: PlayerKillEvent): Promise<HandlerResult> {
    const { weapon, headshot, killerId, victimId } = event.data
    const serverId = event.serverId
    const eventTime = event.timestamp

    try {
      await this.db.transaction(async (tx) => {
        // 1. Record the frag event
        await tx.eventFrag.create({
          data: {
            eventTime,
            serverId,
            killerId,
            victimId,
            weapon,
            headshot: headshot ? 1 : 0,
            map: "", // Map would come from server context
            // Position data would come from event if available
            killerRole: event.data.killerTeam,
            victimRole: event.data.victimTeam,
          },
        })

        // 2. Update global weapon statistics
        await tx.weapon.upsert({
          where: {
            gamecode: {
              game: "csgo", // Would be dynamic based on server game
              code: weapon.toLowerCase(),
            },
          },
          update: {
            kills: { increment: 1 },
            headshots: { increment: headshot ? 1 : 0 },
          },
          create: {
            game: "csgo",
            code: weapon.toLowerCase(),
            name: weapon,
            kills: 1,
            headshots: headshot ? 1 : 0,
            modifier: 1.0,
          },
        })

        // 3. Update player statistics
        await tx.player.update({
          where: { playerId: killerId },
          data: {
            kills: { increment: 1 },
            headshots: { increment: headshot ? 1 : 0 },
          },
        })

        await tx.player.update({
          where: { playerId: victimId },
          data: {
            deaths: { increment: 1 },
          },
        })

        // 4. Track weapon usage in player names table (if tracking per-name stats)
        // The EventFrag table already captures all the weapon kill details we need
      })

      this.logger.event(
        `Weapon kill recorded: ${weapon} (headshot: ${headshot}) by player ${killerId} on ${victimId}`,
      )

      return {
        success: true,
        weaponsAffected: [weapon],
      }
    } catch (error) {
      this.logger.failed(
        `Failed to record weapon kill: ${weapon}`,
        error instanceof Error ? error.message : String(error),
      )
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown weapon stats error",
      }
    }
  }

  /**
   * Update weapon accuracy statistics from shot events
   * This should be called when shot events are available from game logs
   */
  async updateWeaponAccuracy(
    playerId: number,
    shots: number,
    hits: number,
  ): Promise<void> {
    try {
      // Update player's overall shot statistics
      await this.db.prisma.player.update({
        where: { playerId },
        data: {
          shots: { increment: shots },
          hits: { increment: hits },
        },
      })

      const accuracy = shots > 0 ? (hits / shots) * 100 : 0
      this.logger.debug(
        `Updated weapon accuracy for player ${playerId}: ${hits}/${shots} (${accuracy.toFixed(1)}%)`,
      )
    } catch (error) {
      this.logger.failed(
        `Failed to update weapon accuracy for player ${playerId}`,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  /**
   * Get weapon statistics for a player based on EventFrag records
   */
  async getPlayerWeaponStats(playerId: number, weapon?: string): Promise<PlayerWeaponStats[]> {
    try {
      const whereClause: { killerId: number; weapon?: string } = { killerId: playerId }
      if (weapon) {
        whereClause.weapon = weapon
      }

      // Get weapon statistics from frag events
      const fragStats = await this.db.prisma.eventFrag.groupBy({
        by: ["weapon"],
        where: whereClause,
        _count: {
          id: true, // Total kills with weapon
        },
        _sum: {
          headshot: true, // Total headshots
        },
      })

      // Get overall player accuracy (shots/hits are global, not per weapon)
      const player = await this.db.prisma.player.findUnique({
        where: { playerId },
        select: { shots: true, hits: true },
      })

      return fragStats.map((stat) => ({
        playerId,
        weapon: stat.weapon,
        shots: player?.shots || 0, // Global shots (not weapon-specific)
        hits: player?.hits || 0, // Global hits (not weapon-specific)
        kills: stat._count.id,
        headshots: stat._sum.headshot || 0,
        damage: 0, // Would need separate tracking if needed
      }))
    } catch (error) {
      this.logger.failed(
        `Failed to get weapon stats for player ${playerId}`,
        error instanceof Error ? error.message : String(error),
      )
      return []
    }
  }

  /**
   * Calculate weapon accuracy percentage
   */
  calculateAccuracy(shots: number, hits: number): number {
    if (shots === 0) return 0
    return (hits / shots) * 100
  }

  /**
   * Get top weapons by kills
   */
  async getTopWeapons(limit: number = 10, game: string = "csgo"): Promise<WeaponStats[]> {
    try {
      const weapons = await this.db.prisma.weapon.findMany({
        where: { game },
        orderBy: { kills: "desc" },
        take: limit,
      })

      return weapons.map((weapon) => ({
        weaponName: weapon.name,
        kills: weapon.kills,
        headshots: weapon.headshots,
        shots: 0, // Would need to aggregate from eventStatsme
        hits: 0, // Would need to aggregate from eventStatsme
        accuracy: weapon.kills > 0 ? (weapon.headshots / weapon.kills) * 100 : 0, // Headshot accuracy
        damage: 0, // Would need to aggregate from eventStatsme
      }))
    } catch (error) {
      this.logger.failed(
        "Failed to get top weapons",
        error instanceof Error ? error.message : String(error),
      )
      return []
    }
  }

  protected async getWeaponDamageMultiplier(weapon: string, headshot: boolean): Promise<number> {
    // Fetch base damage from default config; skill multiplier from service if needed in future
    const DEFAULT_BASE = 30
    const { baseDamage } = getWeaponAttributes(weapon)
    // Reference service for potential future modifier-based calculations (avoids unused property)
    void (await this.weaponService.getSkillMultiplier(undefined, weapon))
    const damage = headshot ? baseDamage * 4.0 : baseDamage || DEFAULT_BASE
    return damage
  }
}
