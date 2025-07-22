/**
 * Ranking Service - HLStats ELO-based skill rating system
 * Based on the legacy HLStats skill calculation algorithm
 */

import type { IRankingService, SkillRating } from "./ranking.types"
import type { ILogger } from "@/shared/utils/logger.types"
import type { HandlerResult } from "@/shared/types/common"
import type { IWeaponRepository } from "../weapon/weapon.types"
import type { Weapon } from "@repo/database/client"

export interface KillContext {
  weapon: string
  headshot: boolean
  killerTeam: string
  victimTeam: string
  distance?: number
  game?: string
}

export class RankingService implements IRankingService {
  // Rating system constants
  private readonly MIN_RATING = 100
  private readonly MAX_RATING = 3000
  private readonly MAX_SKILL_CHANGE = 50
  private readonly DEFAULT_STARTING_RATING = 1000
  private readonly BASE_K_FACTOR = 32
  private readonly VOLATILITY_DIVISOR = 400
  private readonly VICTIM_LOSS_RATIO = 0.8 // Victim loses 80% of killer's gain
  private readonly DEFAULT_WEAPON_MODIFIER = 1.0

  // Cache for weapon modifiers to avoid repeated DB lookups
  private weaponModifierCache: Map<string, number> = new Map()
  private cacheLastUpdated: number = 0
  private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  constructor(
    private readonly logger: ILogger,
    private readonly weaponRepository: IWeaponRepository,
  ) {}

  async handleRatingUpdate(): Promise<HandlerResult> {
    try {
      // This method is called by the event processor
      // Actual rating calculations are done in calculateSkillAdjustment
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Calculate skill rating adjustment for a kill event
   * Based on modified ELO rating system from PLAYER_RANKINGS.md
   */
  async calculateSkillAdjustment(
    killerRating: SkillRating,
    victimRating: SkillRating,
    context: KillContext,
  ): Promise<{ killerChange: number; victimChange: number }> {
    // Handle team kills with penalties
    if (context.killerTeam === context.victimTeam) {
      return this.calculateTeamKillPenalty()
    }

    // Calculate expected score using ELO formula
    const expectedScore = this.calculateExpectedScore(killerRating.rating, victimRating.rating)

    // Get dynamic K-factor based on killer's experience
    const kFactor = this.getKFactor(killerRating.gamesPlayed, killerRating.rating)

    // Calculate base rating change
    let baseChange = kFactor * (1 - expectedScore)

    // Apply weapon multiplier
    const weaponMultiplier = await this.getWeaponMultiplier(context.weapon, context.game)
    baseChange *= weaponMultiplier

    // Apply headshot bonus
    if (context.headshot) {
      baseChange *= 1.2
    }

    // Cap gains at maximum
    if (baseChange > this.MAX_SKILL_CHANGE) {
      baseChange = this.MAX_SKILL_CHANGE
    }

    // Calculate final changes
    const killerGain = Math.round(baseChange)
    const victimLoss = -Math.round(baseChange * this.VICTIM_LOSS_RATIO)

    // Apply rating bounds
    const finalKillerChange = this.applyRatingBounds(killerRating.rating, killerGain)
    const finalVictimChange = this.applyRatingBounds(victimRating.rating, victimLoss)

    this.logger.debug(
      `Skill calculation: ${context.weapon} kill, ` +
        `${context.headshot ? "headshot, " : ""}` +
        `expected: ${expectedScore.toFixed(3)}, k-factor: ${kFactor}, ` +
        `weapon multiplier: ${weaponMultiplier}, ` +
        `killer: ${killerRating.rating} → ${killerRating.rating + finalKillerChange} (${finalKillerChange > 0 ? "+" : ""}${finalKillerChange}), ` +
        `victim: ${victimRating.rating} → ${victimRating.rating + finalVictimChange} (${finalVictimChange})`,
    )

    return {
      killerChange: finalKillerChange,
      victimChange: finalVictimChange,
    }
  }

  /**
   * Calculate suicide penalty
   */
  calculateSuicidePenalty(): number {
    return -5 // Fixed penalty for suicides
  }

  /**
   * Calculate team kill penalties
   */
  private calculateTeamKillPenalty(): { killerChange: number; victimChange: number } {
    return {
      killerChange: -10, // Penalty for team killer
      victimChange: +2, // Compensation for team kill victim
    }
  }

  /**
   * Calculate expected score using ELO formula
   * E = 1 / (1 + 10^((OpponentRating - PlayerRating) / 400))
   */
  private calculateExpectedScore(playerRating: number, opponentRating: number): number {
    const ratingDiff = opponentRating - playerRating
    const exponent = ratingDiff / this.VOLATILITY_DIVISOR
    return 1 / (1 + Math.pow(10, exponent))
  }

  /**
   * Get weapon multiplier for skill calculations
   */
  private async getWeaponMultiplier(weapon: string, game: string = "cstrike"): Promise<number> {
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
      const weaponData = (await this.weaponRepository.findWeaponByCode(normalizedWeapon)) as Weapon | null

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
   * Apply rating bounds to prevent ratings going below/above limits
   */
  private applyRatingBounds(currentRating: number, change: number): number {
    const newRating = currentRating + change

    if (newRating < this.MIN_RATING) {
      return this.MIN_RATING - currentRating
    }

    if (newRating > this.MAX_RATING) {
      return this.MAX_RATING - currentRating
    }

    return change
  }

  /**
   * Get dynamic K-factor based on player experience and rating
   * From PLAYER_RANKINGS.md spec
   */
  private getKFactor(gamesPlayed: number, rating: number): number {
    // New players (0-10 games): K × 1.5 = 48
    if (gamesPlayed < 10) return this.BASE_K_FACTOR * 1.5

    // Learning players (10-50 games): K × 1.2 = 38.4
    if (gamesPlayed < 50) return this.BASE_K_FACTOR * 1.2

    // Elite players (2000+ rating): K × 0.8 = 25.6
    if (rating >= 2000) return this.BASE_K_FACTOR * 0.8

    // Experienced players (50+ games): K × 1.0 = 32
    return this.BASE_K_FACTOR
  }

  /**
   * Calculate rating adjustment using standard ELO formula
   * This is a simplified version without weapon/headshot modifiers
   */
  async calculateRatingAdjustment(
    winnerRating: SkillRating,
    loserRating: SkillRating,
  ): Promise<{ winner: number; loser: number }> {
    // Calculate expected score for winner
    const expectedScore = this.calculateExpectedScore(winnerRating.rating, loserRating.rating)

    // Get K-factor for winner
    const kFactor = this.getKFactor(winnerRating.gamesPlayed, winnerRating.rating)

    // Calculate rating change (actual score = 1 for winner)
    const winnerGain = Math.round(kFactor * (1 - expectedScore))

    // Apply bounds and calculate loser's loss
    const boundedWinnerGain = this.applyRatingBounds(winnerRating.rating, winnerGain)
    const loserLoss = -Math.round(boundedWinnerGain * this.VICTIM_LOSS_RATIO)
    const boundedLoserLoss = this.applyRatingBounds(loserRating.rating, loserLoss)

    return {
      winner: boundedWinnerGain,
      loser: boundedLoserLoss,
    }
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
