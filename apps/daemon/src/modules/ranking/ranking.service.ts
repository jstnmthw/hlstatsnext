/**
 * Ranking Service - HLStats ELO-based skill rating system
 * Based on the legacy HLStats skill calculation algorithm
 */

import type { IRankingService, SkillRating } from "./ranking.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { IWeaponRepository } from "../weapon/weapon.types"
import type { Weapon } from "@repo/database/client"
import { GameConfig } from "@/config/game.config"
import {
  calculateKillSkillAdjustment,
  calculateStandardRatingAdjustment,
  calculateSuicidePenalty as calculateSuicidePenaltyPure,
  type SkillRatingInput,
  type KillContextInput,
  type SkillCalculationConfig,
} from "@/shared/application/utils/skill-calculator"

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
        `killer: ${killerRating.rating} → ${killerRating.rating + adjustment.killerChange} (${adjustment.killerChange > 0 ? "+" : ""}${adjustment.killerChange}), ` +
        `victim: ${victimRating.rating} → ${victimRating.rating + adjustment.victimChange} (${adjustment.victimChange})`,
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
}
