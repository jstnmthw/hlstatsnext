/**
 * Ranking Service - HLStats ELO-based skill rating system
 * Based on the legacy HLStats skill calculation algorithm
 */

import { GameConfig } from "@/config/game.config"
import type { TransactionalPrisma } from "@/database/client"
import {
  calculateKillSkillAdjustment,
  calculateStandardRatingAdjustment,
  calculateSuicidePenalty as calculateSuicidePenaltyPure,
  type KillContextInput,
  type SkillCalculationConfig,
  type SkillRatingInput,
} from "@/shared/application/utils/skill-calculator"
import type { ILogger } from "@/shared/utils/logger.types"
import type { Weapon } from "@repo/database/client"
import type { IWeaponRepository } from "../weapon/weapon.types"
import type { IRankingService, SkillRating } from "./ranking.types"

export interface KillContext {
  weapon: string
  headshot: boolean
  killerTeam: string
  victimTeam: string
  distance?: number
  game?: string
}

export class RankingService implements IRankingService {
  // Default weapon modifier for unknown weapons
  private readonly DEFAULT_WEAPON_MODIFIER = 1.0

  // Skill calculation configuration
  private readonly skillConfig: Partial<SkillCalculationConfig> = {
    minRating: 100,
    maxRating: 3000,
    maxSkillChange: 50,
    baseKFactor: 32,
    volatilityDivisor: 400,
    victimLossRatio: 0.8,
    headshotBonus: 1.2,
    teamKillPenalty: -10,
    teamKillVictimCompensation: 2,
    suicidePenalty: -5,
  }

  // Cache for weapon modifiers to avoid repeated DB lookups
  private weaponModifierCache: Map<string, number> = new Map()
  private cacheLastUpdated: number = 0
  private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  constructor(
    private readonly logger: ILogger,
    private readonly weaponRepository: IWeaponRepository,
    private readonly db: TransactionalPrisma,
  ) {}

  /**
   * Calculate skill rating adjustment for a kill event
   *
   * Uses a modified ELO rating system where:
   * - Expected outcome is calculated based on rating difference
   * - K-factor is dynamic based on player experience (higher for new players)
   * - Weapon modifiers affect the reward (e.g., knife kills worth more)
   * - Headshots provide a 20% bonus
   * - Team kills result in penalties for the killer and compensation for victim
   * - Victim loses 80% of what the killer gains to prevent rating inflation
   */
  async calculateSkillAdjustment(
    killerRating: SkillRating,
    victimRating: SkillRating,
    context: KillContext,
  ): Promise<{ killerChange: number; victimChange: number }> {
    const weaponMultiplier = await this.getWeaponMultiplier(context.weapon, context.game)

    const killerInput: SkillRatingInput = {
      rating: killerRating.rating,
      gamesPlayed: killerRating.gamesPlayed,
    }

    const victimInput: SkillRatingInput = {
      rating: victimRating.rating,
      gamesPlayed: victimRating.gamesPlayed,
    }

    const killContext: KillContextInput = {
      weapon: context.weapon,
      weaponModifier: weaponMultiplier,
      headshot: context.headshot,
      isTeamKill: context.killerTeam === context.victimTeam,
    }

    const adjustment = calculateKillSkillAdjustment(
      killerInput,
      victimInput,
      killContext,
      this.skillConfig,
    )

    this.logger.debug(
      `Skill calculation: ${context.weapon} kill, ` +
        `${context.headshot ? "headshot, " : ""}` +
        `weapon multiplier: ${weaponMultiplier}, ` +
        `killer: ${killerRating.rating} →  ${killerRating.rating + adjustment.killerChange} (${adjustment.killerChange > 0 ? "+" : ""}${adjustment.killerChange}), ` +
        `victim: ${victimRating.rating} →  ${victimRating.rating + adjustment.victimChange} (${adjustment.victimChange})`,
    )

    return adjustment
  }

  /**
   * Calculate suicide penalty
   *
   * Returns a fixed negative rating adjustment applied when a player
   * kills themselves (falling, grenades, console kill, etc.)
   * Default: -5 rating points
   */
  calculateSuicidePenalty(): number {
    return calculateSuicidePenaltyPure(this.skillConfig)
  }

  /**
   * Calculate penalty for teamkill events
   *
   * Returns a fixed negative rating adjustment applied when a player
   * kills a teammate. This is typically a larger penalty than suicide.
   * Default: -10 rating points
   */
  calculateTeamkillPenalty(): number {
    // For now, use double the suicide penalty as teamkills are more serious
    return calculateSuicidePenaltyPure(this.skillConfig) * 2
  }

  /**
   * Get weapon multiplier for skill calculations
   *
   * Weapon modifiers are stored in the database and are used to adjust the skill rating for a kill.
   * The modifier is a multiplier that is applied to the skill rating of the killer and victim.
   */
  private async getWeaponMultiplier(
    weapon: string,
    game: string = GameConfig.getDefaultGame(),
  ): Promise<number> {
    // Normalize weapon name (remove prefixes, convert to lowercase)
    const normalizedWeapon = weapon
      .toLowerCase()
      .replace(/^weapon_/, "")
      .replace(/^item_/, "")

    // Check cache first
    const cacheKey = `${game}:${normalizedWeapon}`
    const now = Date.now()

    // Refresh cache if expired
    if (now - this.cacheLastUpdated > this.CACHE_TTL_MS) {
      this.weaponModifierCache.clear()
      this.cacheLastUpdated = now
    }

    // Return cached value if available
    if (this.weaponModifierCache.has(cacheKey)) {
      return this.weaponModifierCache.get(cacheKey)!
    }

    try {
      // Fetch from database
      const weaponData = (await this.weaponRepository.findWeaponByCode(
        normalizedWeapon,
      )) as Weapon | null

      if (weaponData && weaponData.modifier) {
        const modifier = Number(weaponData.modifier)
        this.weaponModifierCache.set(cacheKey, modifier)
        return modifier
      }

      // Return default modifier if weapon not found
      this.logger.debug(`Weapon modifier not found for ${normalizedWeapon}, using default`)
      this.weaponModifierCache.set(cacheKey, this.DEFAULT_WEAPON_MODIFIER)
      return this.DEFAULT_WEAPON_MODIFIER
    } catch (error) {
      this.logger.error(`Error fetching weapon modifier for ${normalizedWeapon}: ${error}`)
      return this.DEFAULT_WEAPON_MODIFIER
    }
  }

  /**
   * Calculate rating adjustment for win/loss scenarios
   *
   * Standard ELO calculation without kill-specific modifiers.
   * Used for round wins, objective completions, or other binary outcomes.
   *
   * The winner gains points based on:
   * - Expected probability of winning (lower rated players gain more)
   * - K-factor (new players have more volatile ratings)
   * The loser loses 80% of what the winner gains.
   */
  async calculateRatingAdjustment(
    winnerRating: SkillRating,
    loserRating: SkillRating,
  ): Promise<{ winner: number; loser: number }> {
    // Convert to skill calculator input format
    const winnerInput: SkillRatingInput = {
      rating: winnerRating.rating,
      gamesPlayed: winnerRating.gamesPlayed,
    }

    const loserInput: SkillRatingInput = {
      rating: loserRating.rating,
      gamesPlayed: loserRating.gamesPlayed,
    }

    // Use pure function for calculation
    return calculateStandardRatingAdjustment(winnerInput, loserInput, this.skillConfig)
  }

  /**
   * Clear the weapon modifier cache
   * Useful for testing or when weapon data is updated
   */
  clearWeaponCache(): void {
    this.weaponModifierCache.clear()
    this.cacheLastUpdated = 0
  }

  /**
   * Get the rank position of a player based on skill (1 = highest skill)
   * Uses efficient database query with RANK() window function
   */
  async getPlayerRankPosition(playerId: number): Promise<number> {
    try {
      // Use raw SQL for efficient ranking calculation
      const result = await this.db.$queryRaw<Array<{ rank: bigint }>>`
        SELECT rank_pos as \`rank\`
        FROM (
          SELECT
            player_id,
            RANK() OVER (ORDER BY skill DESC) as rank_pos
          FROM players
          WHERE hide_ranking = 0
        ) ranked
        WHERE player_id = ${playerId}
      `

      if (result.length === 0) {
        this.logger.warn(`Player ${playerId} not found in ranking query`)
        return 0 // Player not found or has rankings hidden
      }

      // Convert BigInt to number
      const rank = Number(result[0]?.rank ?? 0)

      this.logger.debug(`Player ${playerId} rank: ${rank}`)
      return rank
    } catch (error) {
      this.logger.error(`Failed to get rank position for player ${playerId}`, {
        playerId,
        error: error instanceof Error ? error.message : String(error),
      })
      return 0 // Return 0 on error to indicate no ranking
    }
  }

  /**
   * Get rank positions for multiple players efficiently
   * Returns a Map of playerId → rank position
   */
  async getBatchPlayerRanks(playerIds: number[]): Promise<Map<number, number>> {
    const rankMap = new Map<number, number>()

    if (playerIds.length === 0) {
      return rankMap
    }

    try {
      // Use raw SQL for efficient batch ranking calculation
      const result = await this.db.$queryRaw<Array<{ player_id: number; rank: bigint }>>`
        SELECT
          player_id,
          rank_pos as \`rank\`
        FROM (
          SELECT
            player_id,
            RANK() OVER (ORDER BY skill DESC) as rank_pos
          FROM players
          WHERE hide_ranking = 0
        ) ranked
        WHERE player_id IN (${playerIds.join(",")})
      `

      // Convert results to Map
      for (const row of result) {
        rankMap.set(row.player_id, Number(row.rank))
      }

      this.logger.debug(`Retrieved ranks for ${result.length}/${playerIds.length} players`, {
        requestedCount: playerIds.length,
        foundCount: result.length,
      })

      // Fill missing players with rank 0
      for (const playerId of playerIds) {
        if (!rankMap.has(playerId)) {
          rankMap.set(playerId, 0)
        }
      }

      return rankMap
    } catch (error) {
      this.logger.error(`Failed to get batch player ranks`, {
        playerIds: playerIds.slice(0, 10), // Log first 10 IDs
        playerCount: playerIds.length,
        error: error instanceof Error ? error.message : String(error),
      })

      // Return map with all players having rank 0 on error
      for (const playerId of playerIds) {
        rankMap.set(playerId, 0)
      }
      return rankMap
    }
  }
}
